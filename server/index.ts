// The API server. It also serves the built web app (dist/) in production.
import express from 'express'
import compression from 'compression'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { db } from './db.ts'
import {
  COOKIE_NAME,
  DUMMY_HASH,
  hashPassword,
  checkPassword,
  startSession,
  endSession,
  endAllSessions,
  requireUser,
  rateLimit,
  tooManyFailedLogins,
  recordFailedLogin,
  clearFailedLogins,
} from './auth.ts'
import { complete, listModels, AiError } from './ai.ts'

const app = express()
app.set('trust proxy', 1) // we run behind the hosting provider's proxy (HTTPS)
app.disable('x-powered-by')
app.use(compression()) // gzip: the app loads about 3x faster
app.use(express.json({ limit: '200kb' }))

// Security headers: no framing (clickjacking), no MIME sniffing, and a
// Content Security Policy that only allows our own scripts.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      // Open Food Facts and a user's own AI server are called straight from the browser
      "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  )
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store')
  next()
})

const toJson = (value: unknown) => (value === undefined ? null : JSON.stringify(value))
const fromJson = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : null)
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isPassword = (value: unknown): value is string => typeof value === 'string' && value.length >= 8 && value.length <= 200
const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.test(value)

// Limits per user, so nobody can fill up the disk.
const MAX_JSON_FIELD = 100_000 // profile, plan, settings, one workout (characters)
const MAX_FOOD_ENTRIES = 50_000
const MAX_WORKOUTS = 10_000
const tooBig = (value: unknown) => (toJson(value)?.length ?? 0) > MAX_JSON_FIELD

function countRows(table: 'food_entries' | 'workouts', userId: number): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(userId) as { n: number }).n
}

// --- account -----------------------------------------------------------------

app.post('/api/auth/register', rateLimit('register', 10, 60 * 60 * 1000), async (req, res) => {
  const { email, password, profile, plan } = req.body ?? {}
  const cleanEmail = String(email ?? '').trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 200) {
    return res.status(400).json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' })
  }
  if (!isPassword(password)) {
    return res.status(400).json({ error: 'Das Passwort braucht mindestens 8 Zeichen.' })
  }
  if (tooBig(profile) || tooBig(plan)) {
    return res.status(400).json({ error: 'Ungültige Daten.' })
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail)) {
    return res.status(409).json({ error: 'Diese E-Mail ist schon registriert.' })
  }

  // profile and plan come from the questionnaire the user filled out before registering
  const passwordHash = await hashPassword(password)
  const kg = Number(profile?.weightKg)
  // the phone's date (the server may be in another time zone)
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.today)) ? String(req.body.today) : new Date().toISOString().slice(0, 10)
  db.exec('BEGIN')
  try {
    const result = db
      .prepare('INSERT INTO users (email, password_hash, profile, plan, settings) VALUES (?, ?, ?, ?, ?)')
      .run(cleanEmail, passwordHash, toJson(profile), toJson(plan), '{}')
    const userId = Number(result.lastInsertRowid)
    if (kg > 20 && kg < 400) {
      db.prepare('INSERT INTO weights (user_id, date, kg) VALUES (?, ?, ?)').run(userId, today, kg)
    }
    db.exec('COMMIT')
    startSession(res, userId)
    res.status(201).json({ ok: true })
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
})

app.post('/api/auth/login', rateLimit('login', 30, 15 * 60 * 1000), async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 200)
  const password = String(req.body?.password ?? '').slice(0, 200)

  if (tooManyFailedLogins(email)) {
    return res.status(429).json({ error: 'Zu viele Versuche. Bitte warte 15 Minuten.' })
  }
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email) as
    | { id: number; password_hash: string }
    | undefined

  // always hash, so the answer takes equally long for unknown emails
  const ok = await checkPassword(password, user?.password_hash ?? DUMMY_HASH)
  if (!user || !ok) {
    recordFailedLogin(email)
    return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch.' })
  }
  clearFailedLogins(email)
  endSession(req, res) // drop an old session of this browser
  startSession(res, user.id)
  res.json({ ok: true })
})

app.post('/api/auth/logout', (req, res) => {
  endSession(req, res)
  res.json({ ok: true })
})

app.get('/api/me', requireUser, (req, res) => {
  const user = db
    .prepare('SELECT email, profile, plan, settings, created_at FROM users WHERE id = ?')
    .get(req.userId) as Record<string, string>
  res.json({
    email: user.email,
    createdAt: user.created_at,
    profile: fromJson(user.profile),
    plan: fromJson(user.plan),
    settings: fromJson(user.settings) ?? {},
  })
})

app.put('/api/me', requireUser, (req, res) => {
  // only these three columns can be changed here (the names are fixed, never from the request)
  const fields = (['profile', 'plan', 'settings'] as const).filter((f) => req.body?.[f] !== undefined)
  if (fields.some((f) => tooBig(req.body[f]))) {
    return res.status(400).json({ error: 'Daten zu groß.' })
  }
  for (const field of fields) {
    db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(toJson(req.body[field]), req.userId)
  }
  res.json({ ok: true })
})

app.put('/api/me/password', requireUser, rateLimit('password', 10, 15 * 60 * 1000), async (req, res) => {
  const { current, next } = req.body ?? {}
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId) as { password_hash: string }
  if (!(await checkPassword(String(current ?? '').slice(0, 200), user.password_hash))) {
    return res.status(401).json({ error: 'Das aktuelle Passwort ist falsch.' })
  }
  if (!isPassword(next)) {
    return res.status(400).json({ error: 'Das neue Passwort braucht mindestens 8 Zeichen.' })
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), req.userId)
  // log out all other devices, this one gets a fresh session
  endAllSessions(req.userId)
  startSession(res, req.userId)
  res.json({ ok: true })
})

app.delete('/api/me', requireUser, rateLimit('delete', 10, 15 * 60 * 1000), async (req, res) => {
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId) as { password_hash: string }
  if (!(await checkPassword(String(req.body?.password ?? '').slice(0, 200), user.password_hash))) {
    return res.status(401).json({ error: 'Das Passwort ist falsch.' })
  }
  // ON DELETE CASCADE removes sessions, workouts, food and weights too
  db.prepare('DELETE FROM users WHERE id = ?').run(req.userId)
  res.clearCookie(COOKIE_NAME)
  res.json({ ok: true })
})

// Everything we store about the user, as one JSON download (GDPR).
app.get('/api/export', requireUser, (req, res) => {
  const user = db.prepare('SELECT email, profile, plan, settings, created_at FROM users WHERE id = ?').get(req.userId) as Record<string, string>
  res.setHeader('Content-Disposition', 'attachment; filename="forma-export.json"')
  res.json({
    email: user.email,
    createdAt: user.created_at,
    profile: fromJson(user.profile),
    plan: fromJson(user.plan),
    settings: fromJson(user.settings),
    workouts: listWorkouts(req.userId, MAX_WORKOUTS),
    food: db.prepare('SELECT eaten_at AS eatenAt, name, amount, kcal, protein, carbs, fat, source FROM food_entries WHERE user_id = ? ORDER BY eaten_at').all(req.userId),
    weights: db.prepare('SELECT date, kg FROM weights WHERE user_id = ? ORDER BY date').all(req.userId),
  })
})

// --- workouts ------------------------------------------------------------------

function listWorkouts(userId: number, limit: number) {
  const rows = db
    .prepare('SELECT id, data FROM workouts WHERE user_id = ? ORDER BY date DESC LIMIT ?')
    .all(userId, limit) as { id: number; data: string }[]
  return rows.map((row) => ({ ...JSON.parse(row.data), id: row.id }))
}

app.get('/api/workouts', requireUser, (req, res) => {
  const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 200, 1), 1000)
  res.json(listWorkouts(req.userId, limit))
})

app.get('/api/workouts/count', requireUser, (req, res) => {
  res.json({ total: countRows('workouts', req.userId) })
})

const isLoggedExercise = (e: unknown) => isObject(e) && typeof e.exerciseId === 'string' && Array.isArray(e.sets) && e.sets.every(isObject)

app.post('/api/workouts', requireUser, (req, res) => {
  const workout = req.body
  if (!isIsoDate(workout?.date) || !Array.isArray(workout.exercises) || !workout.exercises.every(isLoggedExercise) || tooBig(workout)) {
    return res.status(400).json({ error: 'Ungültiges Training.' })
  }
  if (countRows('workouts', req.userId) >= MAX_WORKOUTS) {
    return res.status(403).json({ error: 'Speicherlimit erreicht.' })
  }
  delete workout.id
  const result = db
    .prepare('INSERT INTO workouts (user_id, date, data) VALUES (?, ?, ?)')
    .run(req.userId, workout.date, JSON.stringify(workout))
  res.status(201).json({ ...workout, id: Number(result.lastInsertRowid) })
})

app.delete('/api/workouts/:id', requireUser, (req, res) => {
  db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.userId)
  res.json({ ok: true })
})

// --- food ----------------------------------------------------------------------

const FOOD_COLUMNS = 'id, eaten_at AS eatenAt, name, amount, kcal, protein, carbs, fat, source'

function cleanFood(input: Record<string, unknown>) {
  const number = (value: unknown) => Math.min(Math.max(0, Math.round(Number(value) * 10) / 10 || 0), 20_000)
  return {
    eatenAt: isIsoDate(input.eatenAt) ? input.eatenAt : new Date().toISOString(),
    name: String(input.name ?? '').slice(0, 200) || 'Essen',
    amount: String(input.amount ?? '').slice(0, 100),
    kcal: number(input.kcal),
    protein: number(input.protein),
    carbs: number(input.carbs),
    fat: number(input.fat),
    source: ['ai', 'db', 'manual', 'off'].includes(String(input.source)) ? String(input.source) : 'manual',
  }
}

app.get('/api/food', requireUser, (req, res) => {
  const from = String(req.query.from ?? '0000')
  const to = String(req.query.to ?? '9999')
  res.json(
    db
      .prepare(`SELECT ${FOOD_COLUMNS} FROM food_entries WHERE user_id = ? AND eaten_at >= ? AND eaten_at < ? ORDER BY eaten_at LIMIT 5000`)
      .all(req.userId, from, to),
  )
})

// accepts one entry or a list of up to 50 entries (one meal)
app.post('/api/food', requireUser, (req, res) => {
  const items: unknown[] = Array.isArray(req.body) ? req.body : [req.body]
  if (items.length === 0 || items.length > 50 || !items.every(isObject)) {
    return res.status(400).json({ error: 'Ungültige Einträge.' })
  }
  if (countRows('food_entries', req.userId) + items.length > MAX_FOOD_ENTRIES) {
    return res.status(403).json({ error: 'Speicherlimit erreicht.' })
  }
  const insert = db.prepare(
    'INSERT INTO food_entries (user_id, eaten_at, name, amount, kcal, protein, carbs, fat, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  // one transaction: all entries are saved, or none
  db.exec('BEGIN')
  try {
    const saved = items.map((item) => {
      const food = cleanFood(item)
      const result = insert.run(req.userId, food.eatenAt, food.name, food.amount, food.kcal, food.protein, food.carbs, food.fat, food.source)
      return { ...food, id: Number(result.lastInsertRowid) }
    })
    db.exec('COMMIT')
    res.status(201).json(saved)
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
})

app.put('/api/food/:id', requireUser, (req, res) => {
  if (!isObject(req.body)) return res.status(400).json({ error: 'Ungültiger Eintrag.' })
  const food = cleanFood(req.body)
  const result = db
    .prepare('UPDATE food_entries SET eaten_at = ?, name = ?, amount = ?, kcal = ?, protein = ?, carbs = ?, fat = ?, source = ? WHERE id = ? AND user_id = ?')
    .run(food.eatenAt, food.name, food.amount, food.kcal, food.protein, food.carbs, food.fat, food.source, Number(req.params.id), req.userId)
  if (result.changes === 0) return res.status(404).json({ error: 'Nicht gefunden.' })
  res.json({ ...food, id: Number(req.params.id) })
})

app.delete('/api/food/:id', requireUser, (req, res) => {
  db.prepare('DELETE FROM food_entries WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.userId)
  res.json({ ok: true })
})

// --- body weight ---------------------------------------------------------------

app.get('/api/weights', requireUser, (req, res) => {
  res.json(db.prepare('SELECT id, date, kg FROM weights WHERE user_id = ? ORDER BY date').all(req.userId))
})

// one entry per day: saving again on the same day overwrites it
app.post('/api/weights', requireUser, (req, res) => {
  const date = String(req.body?.date ?? '').slice(0, 10)
  const kg = Number(req.body?.kg)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(kg > 20 && kg < 400)) {
    return res.status(400).json({ error: 'Ungültiges Gewicht.' })
  }
  db.prepare(
    'INSERT INTO weights (user_id, date, kg) VALUES (?, ?, ?) ON CONFLICT (user_id, date) DO UPDATE SET kg = excluded.kg',
  ).run(req.userId, date, kg)
  res.status(201).json({ ok: true })
})

app.delete('/api/weights/:id', requireUser, (req, res) => {
  db.prepare('DELETE FROM weights WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.userId)
  res.json({ ok: true })
})

// --- AI ------------------------------------------------------------------------
// Limited per user, so the server can't be misused as a free relay.

const byUser = (req: express.Request) => String(req.userId)

function validAiRequest(body: Record<string, unknown> | undefined): boolean {
  const { provider, model, apiKey } = body ?? {}
  return (
    typeof provider === 'string' &&
    typeof apiKey === 'string' &&
    apiKey.length > 0 &&
    apiKey.length <= 300 &&
    /^[\x21-\x7e]+$/.test(apiKey) && // printable characters only
    (model === undefined || (typeof model === 'string' && model.length <= 200))
  )
}

app.post('/api/ai/complete', requireUser, rateLimit('ai', 30, 60 * 1000, byUser), async (req, res) => {
  const { provider, model, apiKey, system, prompt } = req.body ?? {}
  if (!validAiRequest(req.body) || !model || !prompt) {
    return res.status(400).json({ error: 'API-Key, Modell und Text sind nötig.' })
  }
  try {
    const text = await complete(provider, model, apiKey, String(system ?? '').slice(0, 8000), String(prompt).slice(0, 4000))
    res.json({ text })
  } catch (error) {
    sendAiError(res, error)
  }
})

app.post('/api/ai/models', requireUser, rateLimit('ai-models', 20, 60 * 60 * 1000, byUser), async (req, res) => {
  const { provider, apiKey } = req.body ?? {}
  if (!validAiRequest(req.body)) return res.status(400).json({ error: 'Bitte zuerst einen gültigen API-Key eintragen.' })
  try {
    res.json({ models: await listModels(provider, apiKey) })
  } catch (error) {
    sendAiError(res, error)
  }
})

function sendAiError(res: express.Response, error: unknown) {
  if (error instanceof AiError) {
    // A 401 from the provider means a wrong API key, not that the user is logged out of Forma.
    const status = error.status === 401 || error.status === 403 ? 400 : error.status >= 500 ? 502 : error.status
    return res.status(status).json({ error: error.message })
  }
  // only the error type: the error message could contain the API key
  console.error('AI request failed:', (error as Error)?.name)
  res.status(502).json({ error: 'Der KI-Anbieter ist gerade nicht erreichbar.' })
}

// --- web app -------------------------------------------------------------------

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Nicht gefunden.' })
})

const distDir = path.resolve('dist')
if (existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, file) {
        // file names in assets/ contain a hash, so they can be cached forever;
        // everything else (index.html, sw.js, manifest) must be checked on every visit
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        else if (file.includes(`${path.sep}exercises${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=604800')
        else res.setHeader('Cache-Control', 'no-cache')
      },
    }),
  )
  // every other URL is a page of the single page app;
  // a missing file (e.g. an old script after a deploy) gets a real 404
  app.get('/{*path}', (req, res) => {
    if (path.extname(req.path)) return res.status(404).send('Nicht gefunden')
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => console.log(`Forma läuft auf http://localhost:${port}`))

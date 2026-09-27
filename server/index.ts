// The API server. It also serves the built web app (dist/) in production.
import express from 'express'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { db } from './db.ts'
import {
  hashPassword,
  checkPassword,
  startSession,
  endSession,
  requireUser,
  tooManyAttempts,
  recordFailedAttempt,
  clearAttempts,
} from './auth.ts'
import { complete, listModels, AiError } from './ai.ts'

const app = express()
app.set('trust proxy', 1) // we usually run behind the hosting provider's proxy
app.use(express.json({ limit: '1mb' }))

const toJson = (value: unknown) => (value === undefined ? null : JSON.stringify(value))
const fromJson = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : null)

// --- account -----------------------------------------------------------------

app.post('/api/auth/register', (req, res) => {
  const { email, password, profile, plan } = req.body ?? {}
  const cleanEmail = String(email ?? '').trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' })
  }
  if (String(password ?? '').length < 8) {
    return res.status(400).json({ error: 'Das Passwort braucht mindestens 8 Zeichen.' })
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail)) {
    return res.status(409).json({ error: 'Diese E-Mail ist schon registriert.' })
  }

  // profile and plan come from the questionnaire the user filled out before registering
  const result = db
    .prepare('INSERT INTO users (email, password_hash, profile, plan, settings) VALUES (?, ?, ?, ?, ?)')
    .run(cleanEmail, hashPassword(password), toJson(profile), toJson(plan), '{}')
  const userId = Number(result.lastInsertRowid)

  if (profile?.weightKg) {
    db.prepare('INSERT INTO weights (user_id, date, kg) VALUES (?, ?, ?)').run(
      userId,
      new Date().toISOString().slice(0, 10),
      profile.weightKg,
    )
  }
  startSession(res, userId)
  res.status(201).json({ ok: true })
})

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  const key = `${req.ip}:${email}`

  if (tooManyAttempts(key)) {
    return res.status(429).json({ error: 'Zu viele Versuche. Bitte warte 15 Minuten.' })
  }
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email) as
    | { id: number; password_hash: string }
    | undefined

  if (!user || !checkPassword(password, user.password_hash)) {
    recordFailedAttempt(key)
    return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch.' })
  }
  clearAttempts(key)
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
  for (const field of ['profile', 'plan', 'settings'] as const) {
    if (req.body?.[field] !== undefined) {
      db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(toJson(req.body[field]), req.userId)
    }
  }
  res.json({ ok: true })
})

app.put('/api/me/password', requireUser, (req, res) => {
  const { current, next } = req.body ?? {}
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId) as {
    password_hash: string
  }
  if (!checkPassword(String(current ?? ''), user.password_hash)) {
    return res.status(401).json({ error: 'Das aktuelle Passwort ist falsch.' })
  }
  if (String(next ?? '').length < 8) {
    return res.status(400).json({ error: 'Das neue Passwort braucht mindestens 8 Zeichen.' })
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), req.userId)
  res.json({ ok: true })
})

app.delete('/api/me', requireUser, (req, res) => {
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId) as {
    password_hash: string
  }
  if (!checkPassword(String(req.body?.password ?? ''), user.password_hash)) {
    return res.status(401).json({ error: 'Das Passwort ist falsch.' })
  }
  // ON DELETE CASCADE removes sessions, workouts, food and weights too
  db.prepare('DELETE FROM users WHERE id = ?').run(req.userId)
  res.clearCookie('forma_session')
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
    workouts: listWorkouts(req.userId, 100000),
    food: db.prepare('SELECT * FROM food_entries WHERE user_id = ? ORDER BY eaten_at').all(req.userId),
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
  res.json(listWorkouts(req.userId, Number(req.query.limit) || 200))
})

app.post('/api/workouts', requireUser, (req, res) => {
  const workout = req.body
  if (!workout?.date || !Array.isArray(workout.exercises)) {
    return res.status(400).json({ error: 'Ungültiges Training' })
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
  const number = (value: unknown) => Math.max(0, Math.round(Number(value) * 10) / 10 || 0)
  return {
    eatenAt: String(input.eatenAt ?? new Date().toISOString()),
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
      .prepare(`SELECT ${FOOD_COLUMNS} FROM food_entries WHERE user_id = ? AND eaten_at >= ? AND eaten_at < ? ORDER BY eaten_at`)
      .all(req.userId, from, to),
  )
})

// accepts one entry or a list of entries
app.post('/api/food', requireUser, (req, res) => {
  const items: Record<string, unknown>[] = Array.isArray(req.body) ? req.body : [req.body]
  const insert = db.prepare(
    'INSERT INTO food_entries (user_id, eaten_at, name, amount, kcal, protein, carbs, fat, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  const saved = items.map((item) => {
    const food = cleanFood(item)
    const result = insert.run(req.userId, food.eatenAt, food.name, food.amount, food.kcal, food.protein, food.carbs, food.fat, food.source)
    return { ...food, id: Number(result.lastInsertRowid) }
  })
  res.status(201).json(saved)
})

app.put('/api/food/:id', requireUser, (req, res) => {
  const food = cleanFood(req.body ?? {})
  db.prepare(
    'UPDATE food_entries SET eaten_at = ?, name = ?, amount = ?, kcal = ?, protein = ?, carbs = ?, fat = ?, source = ? WHERE id = ? AND user_id = ?',
  ).run(food.eatenAt, food.name, food.amount, food.kcal, food.protein, food.carbs, food.fat, food.source, Number(req.params.id), req.userId)
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
    return res.status(400).json({ error: 'Ungültiges Gewicht' })
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

app.post('/api/ai/complete', requireUser, async (req, res) => {
  const { provider, model, apiKey, system, prompt } = req.body ?? {}
  if (!apiKey || !model || !prompt) return res.status(400).json({ error: 'API-Key, Modell und Text sind nötig.' })
  try {
    const text = await complete(provider, model, apiKey, String(system ?? ''), String(prompt).slice(0, 4000))
    res.json({ text })
  } catch (error) {
    sendAiError(res, error)
  }
})

app.post('/api/ai/models', requireUser, async (req, res) => {
  const { provider, apiKey } = req.body ?? {}
  if (!apiKey) return res.status(400).json({ error: 'Bitte zuerst einen API-Key eintragen.' })
  try {
    res.json({ models: await listModels(provider, apiKey) })
  } catch (error) {
    sendAiError(res, error)
  }
})

function sendAiError(res: express.Response, error: unknown) {
  if (error instanceof AiError) return res.status(error.status).json({ error: error.message })
  console.error(error)
  res.status(502).json({ error: 'Der KI-Anbieter ist gerade nicht erreichbar.' })
}

// --- web app -------------------------------------------------------------------

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Nicht gefunden' })
})

const distDir = path.resolve('dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }))
  // every other URL is a page of the single page app
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => console.log(`Forma läuft auf http://localhost:${port}`))

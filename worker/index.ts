// The API of Forma as a Cloudflare Worker (Hono + D1).
// The web app itself is served by Cloudflare as static files from dist/ (see wrangler.jsonc).
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv, Env } from './env.ts'
import { checkPassword, hashPassword } from './password.ts'
import {
  cleanUp,
  clearRequests,
  countRequest,
  endAllSessions,
  endSession,
  rateLimit,
  requestCount,
  requireUser,
  startSession,
} from './auth.ts'
import { complete, listModels, AiError } from './ai.ts'

const app = new Hono<AppEnv>().basePath('/api')

// rejects form posts from other websites (the app itself only sends JSON)
app.use(csrf())
app.use(bodyLimit({ maxSize: 200 * 1024, onError: (c) => c.json({ error: 'Anfrage zu groß.' }, 413) }))
app.use(async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'no-referrer')
})

// --- helpers -------------------------------------------------------------------

type Row = Record<string, unknown>
const toJson = (value: unknown) => (value === undefined ? null : JSON.stringify(value))
const fromJson = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : null)
const isObject = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value)
const isPassword = (value: unknown): value is string => typeof value === 'string' && value.length >= 8 && value.length <= 200
const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.test(value)
const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

// read the JSON body; a broken body counts as empty
async function body(c: Context<AppEnv>): Promise<Row> {
  const data = await c.req.json().catch(() => null)
  return isObject(data) || Array.isArray(data) ? (data as Row) : {}
}

// Limits per user, so nobody can fill up the database.
const MAX_JSON_FIELD = 100_000 // profile, plan, settings, one workout (characters)
const MAX_FOOD_ENTRIES = 50_000
const MAX_WORKOUTS = 10_000
const tooBig = (value: unknown) => (toJson(value)?.length ?? 0) > MAX_JSON_FIELD

async function countRows(c: Context<AppEnv>, table: 'food_entries' | 'workouts'): Promise<number> {
  const row = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).bind(c.var.userId).first<{ n: number }>()
  return row?.n ?? 0
}

const iterations = (env: Env) => Number(env.PASSWORD_ITERATIONS) || undefined

// Used when the email does not exist, so a login takes the same time either way
// (otherwise the response time would reveal who has an account).
let dummyHash: Promise<string> | null = null
const getDummyHash = (env: Env) => (dummyHash ??= hashPassword(crypto.randomUUID(), iterations(env)))

async function passwordHashOf(c: Context<AppEnv>): Promise<string> {
  const user = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(c.var.userId).first<{ password_hash: string }>()
  return user?.password_hash ?? ''
}

// --- account -----------------------------------------------------------------

const LOGIN_WINDOW = 15 * 60 * 1000

app.post('/auth/register', rateLimit('register', 10, 60 * 60 * 1000), async (c) => {
  const { email, password, profile, plan, today } = await body(c)
  const cleanEmail = String(email ?? '').trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 200) {
    return c.json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' }, 400)
  }
  if (!isPassword(password)) return c.json({ error: 'Das Passwort braucht mindestens 8 Zeichen.' }, 400)
  if (tooBig(profile) || tooBig(plan)) return c.json({ error: 'Ungültige Daten.' }, 400)
  if (await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(cleanEmail).first()) {
    return c.json({ error: 'Diese E-Mail ist schon registriert.' }, 409)
  }

  // profile and plan come from the questionnaire the user filled out before registering
  const passwordHash = await hashPassword(password, iterations(c.env))
  const kg = Number(isObject(profile) ? profile.weightKg : NaN)
  // the phone's date (the server runs in UTC)
  const day = isDay(today) ? today : new Date().toISOString().slice(0, 10)
  const statements = [
    c.env.DB.prepare('INSERT INTO users (email, password_hash, profile, plan, settings) VALUES (?, ?, ?, ?, ?)').bind(
      cleanEmail,
      passwordHash,
      toJson(profile),
      toJson(plan),
      '{}',
    ),
  ]
  if (kg > 20 && kg < 400) {
    statements.push(c.env.DB.prepare('INSERT INTO weights (user_id, date, kg) SELECT id, ?, ? FROM users WHERE email = ?').bind(day, kg, cleanEmail))
  }
  await c.env.DB.batch(statements) // one transaction: all or nothing

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(cleanEmail).first<{ id: number }>()
  await startSession(c, user!.id)
  return c.json({ ok: true }, 201)
})

app.post('/auth/login', rateLimit('login', 30, LOGIN_WINDOW), async (c) => {
  const data = await body(c)
  const email = String(data.email ?? '').trim().toLowerCase().slice(0, 200)
  const password = String(data.password ?? '').slice(0, 200)
  const failKey = `login-failed:${email}`

  // max 10 wrong passwords per email in 15 minutes, no matter from which IP
  if ((await requestCount(c, failKey, LOGIN_WINDOW)) >= 10) {
    return c.json({ error: 'Zu viele Versuche. Bitte warte 15 Minuten.' }, 429)
  }
  const user = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number; password_hash: string }>()

  // always hash, so the answer takes equally long for unknown emails
  const ok = await checkPassword(password, user?.password_hash ?? (await getDummyHash(c.env)))
  if (!user || !ok) {
    await countRequest(c, failKey, 10, LOGIN_WINDOW)
    return c.json({ error: 'E-Mail oder Passwort ist falsch.' }, 401)
  }
  await clearRequests(c, failKey)
  await endSession(c) // drop an old session of this browser
  await startSession(c, user.id)
  return c.json({ ok: true })
})

app.post('/auth/logout', async (c) => {
  await endSession(c)
  return c.json({ ok: true })
})

async function loadMe(c: Context<AppEnv>) {
  const user = await c.env.DB.prepare('SELECT email, profile, plan, settings, created_at FROM users WHERE id = ?').bind(c.var.userId).first<Row>()
  return {
    email: user?.email,
    createdAt: user?.created_at,
    profile: fromJson(user?.profile),
    plan: fromJson(user?.plan),
    settings: fromJson(user?.settings) ?? {},
  }
}

app.get('/me', requireUser, async (c) => c.json(await loadMe(c)))

app.put('/me', requireUser, async (c) => {
  const data = await body(c)
  // only these three columns can be changed here (the names are fixed, never from the request)
  const fields = (['profile', 'plan', 'settings'] as const).filter((f) => data[f] !== undefined)
  if (fields.some((f) => tooBig(data[f]))) return c.json({ error: 'Daten zu groß.' }, 400)
  if (fields.length > 0) {
    await c.env.DB.batch(fields.map((f) => c.env.DB.prepare(`UPDATE users SET ${f} = ? WHERE id = ?`).bind(toJson(data[f]), c.var.userId)))
  }
  return c.json({ ok: true })
})

app.put('/me/password', requireUser, rateLimit('password', 10, LOGIN_WINDOW), async (c) => {
  const { current, next } = await body(c)
  if (!(await checkPassword(String(current ?? '').slice(0, 200), await passwordHashOf(c)))) {
    return c.json({ error: 'Das aktuelle Passwort ist falsch.' }, 401)
  }
  if (!isPassword(next)) return c.json({ error: 'Das neue Passwort braucht mindestens 8 Zeichen.' }, 400)
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(next, iterations(c.env)), c.var.userId).run()
  // log out all other devices, this one gets a fresh session
  await endAllSessions(c, c.var.userId)
  await startSession(c, c.var.userId)
  return c.json({ ok: true })
})

app.delete('/me', requireUser, rateLimit('delete', 10, LOGIN_WINDOW), async (c) => {
  const { password } = await body(c)
  if (!(await checkPassword(String(password ?? '').slice(0, 200), await passwordHashOf(c)))) {
    return c.json({ error: 'Das Passwort ist falsch.' }, 401)
  }
  // ON DELETE CASCADE removes sessions, workouts, food and weights too
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(c.var.userId).run()
  await endSession(c)
  return c.json({ ok: true })
})

// Everything we store about the user, as one JSON download (GDPR).
app.get('/export', requireUser, async (c) => {
  const id = c.var.userId
  const [food, weights] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT eaten_at AS eatenAt, name, amount, kcal, protein, carbs, fat, source FROM food_entries WHERE user_id = ? ORDER BY eaten_at').bind(id),
    c.env.DB.prepare('SELECT date, kg FROM weights WHERE user_id = ? ORDER BY date').bind(id),
  ])
  c.header('Content-Disposition', 'attachment; filename="forma-export.json"')
  return c.json({ ...(await loadMe(c)), workouts: await listWorkouts(c, MAX_WORKOUTS), food: food.results, weights: weights.results })
})

// --- workouts ------------------------------------------------------------------

async function listWorkouts(c: Context<AppEnv>, limit: number) {
  const { results } = await c.env.DB.prepare('SELECT id, data FROM workouts WHERE user_id = ? ORDER BY date DESC LIMIT ?')
    .bind(c.var.userId, limit)
    .all<{ id: number; data: string }>()
  return results.map((row) => ({ ...JSON.parse(row.data), id: row.id }))
}

app.get('/workouts', requireUser, async (c) => {
  const limit = Math.min(Math.max(Math.trunc(Number(c.req.query('limit'))) || 200, 1), 1000)
  return c.json(await listWorkouts(c, limit))
})

app.get('/workouts/count', requireUser, async (c) => c.json({ total: await countRows(c, 'workouts') }))

const isLoggedExercise = (e: unknown) => isObject(e) && typeof e.exerciseId === 'string' && Array.isArray(e.sets) && e.sets.every(isObject)

app.post('/workouts', requireUser, async (c) => {
  const workout = await body(c)
  if (!isIsoDate(workout.date) || !Array.isArray(workout.exercises) || !workout.exercises.every(isLoggedExercise) || tooBig(workout)) {
    return c.json({ error: 'Ungültiges Training.' }, 400)
  }
  if ((await countRows(c, 'workouts')) >= MAX_WORKOUTS) return c.json({ error: 'Speicherlimit erreicht.' }, 403)
  delete workout.id
  const row = await c.env.DB.prepare('INSERT INTO workouts (user_id, date, data) VALUES (?, ?, ?) RETURNING id')
    .bind(c.var.userId, workout.date, JSON.stringify(workout))
    .first<{ id: number }>()
  return c.json({ ...workout, id: row?.id }, 201)
})

app.delete('/workouts/:id', requireUser, async (c) => {
  await c.env.DB.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), c.var.userId).run()
  return c.json({ ok: true })
})

// --- food ----------------------------------------------------------------------

const FOOD_COLUMNS = 'id, eaten_at AS eatenAt, name, amount, kcal, protein, carbs, fat, source'

function cleanFood(input: Row) {
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

app.get('/food', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ${FOOD_COLUMNS} FROM food_entries WHERE user_id = ? AND eaten_at >= ? AND eaten_at < ? ORDER BY eaten_at LIMIT 5000`,
  )
    .bind(c.var.userId, c.req.query('from') ?? '0000', c.req.query('to') ?? '9999')
    .all()
  return c.json(results)
})

// accepts one entry or a list of up to 50 entries (one meal)
app.post('/food', requireUser, async (c) => {
  const data = await body(c)
  const items: unknown[] = Array.isArray(data) ? data : [data]
  if (items.length === 0 || items.length > 50 || !items.every(isObject)) return c.json({ error: 'Ungültige Einträge.' }, 400)
  if ((await countRows(c, 'food_entries')) + items.length > MAX_FOOD_ENTRIES) return c.json({ error: 'Speicherlimit erreicht.' }, 403)

  const foods = items.map((item) => cleanFood(item as Row))
  // one transaction: all entries are saved, or none
  const results = await c.env.DB.batch(
    foods.map((f) =>
      c.env.DB.prepare(
        'INSERT INTO food_entries (user_id, eaten_at, name, amount, kcal, protein, carbs, fat, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      ).bind(c.var.userId, f.eatenAt, f.name, f.amount, f.kcal, f.protein, f.carbs, f.fat, f.source),
    ),
  )
  return c.json(
    foods.map((f, i) => ({ ...f, id: (results[i].results[0] as { id: number }).id })),
    201,
  )
})

app.put('/food/:id', requireUser, async (c) => {
  const data = await body(c)
  if (Array.isArray(data)) return c.json({ error: 'Ungültiger Eintrag.' }, 400)
  const f = cleanFood(data)
  const result = await c.env.DB.prepare(
    'UPDATE food_entries SET eaten_at = ?, name = ?, amount = ?, kcal = ?, protein = ?, carbs = ?, fat = ?, source = ? WHERE id = ? AND user_id = ?',
  )
    .bind(f.eatenAt, f.name, f.amount, f.kcal, f.protein, f.carbs, f.fat, f.source, Number(c.req.param('id')), c.var.userId)
    .run()
  if (result.meta.changes === 0) return c.json({ error: 'Nicht gefunden.' }, 404)
  return c.json({ ...f, id: Number(c.req.param('id')) })
})

app.delete('/food/:id', requireUser, async (c) => {
  await c.env.DB.prepare('DELETE FROM food_entries WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), c.var.userId).run()
  return c.json({ ok: true })
})

// --- body weight ---------------------------------------------------------------

app.get('/weights', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, date, kg FROM weights WHERE user_id = ? ORDER BY date').bind(c.var.userId).all()
  return c.json(results)
})

// one entry per day: saving again on the same day overwrites it
app.post('/weights', requireUser, async (c) => {
  const data = await body(c)
  const kg = Number(data.kg)
  if (!isDay(data.date) || !(kg > 20 && kg < 400)) return c.json({ error: 'Ungültiges Gewicht.' }, 400)
  await c.env.DB.prepare('INSERT INTO weights (user_id, date, kg) VALUES (?, ?, ?) ON CONFLICT (user_id, date) DO UPDATE SET kg = excluded.kg')
    .bind(c.var.userId, data.date, kg)
    .run()
  return c.json({ ok: true }, 201)
})

app.delete('/weights/:id', requireUser, async (c) => {
  await c.env.DB.prepare('DELETE FROM weights WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), c.var.userId).run()
  return c.json({ ok: true })
})

// --- AI ------------------------------------------------------------------------
// Limited per user, so the server can't be misused as a free relay.

const byUser = (c: Context<AppEnv>) => String(c.var.userId)

function validAiRequest({ provider, model, apiKey }: Row): boolean {
  return (
    typeof provider === 'string' &&
    typeof apiKey === 'string' &&
    apiKey.length > 0 &&
    apiKey.length <= 300 &&
    /^[\x21-\x7e]+$/.test(apiKey) && // printable characters only
    (model === undefined || (typeof model === 'string' && model.length <= 200))
  )
}

app.post('/ai/complete', requireUser, rateLimit('ai', 30, 60 * 1000, byUser), async (c) => {
  const data = await body(c)
  if (!validAiRequest(data) || !data.model || !data.prompt) return c.json({ error: 'API-Key, Modell und Text sind nötig.' }, 400)
  try {
    const text = await complete(String(data.provider), String(data.model), String(data.apiKey), String(data.system ?? '').slice(0, 8000), String(data.prompt).slice(0, 4000))
    return c.json({ text })
  } catch (error) {
    return aiError(c, error)
  }
})

app.post('/ai/models', requireUser, rateLimit('ai-models', 20, 60 * 60 * 1000, byUser), async (c) => {
  const data = await body(c)
  if (!validAiRequest(data)) return c.json({ error: 'Bitte zuerst einen gültigen API-Key eintragen.' }, 400)
  try {
    return c.json({ models: await listModels(String(data.provider), String(data.apiKey)) })
  } catch (error) {
    return aiError(c, error)
  }
})

function aiError(c: Context<AppEnv>, error: unknown) {
  if (error instanceof AiError) {
    // A 401 from the provider means a wrong API key, not that the user is logged out of Forma.
    const status = error.status === 401 || error.status === 403 ? 400 : error.status >= 500 ? 502 : error.status
    return c.json({ error: error.message }, status as 400)
  }
  // only the error type: the error message could contain the API key
  console.error('AI request failed:', (error as Error)?.name)
  return c.json({ error: 'Der KI-Anbieter ist gerade nicht erreichbar.' }, 502)
}

// --- the rest ------------------------------------------------------------------

app.notFound((c) => c.json({ error: 'Nicht gefunden.' }, 404))
app.onError((error, c) => {
  // e.g. the csrf check: keep its status (403) instead of turning it into 500
  if (error instanceof HTTPException) return c.json({ error: 'Anfrage abgelehnt.' }, error.status)
  console.error('Request failed:', error.name, error.message)
  return c.json({ error: 'Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.' }, 500)
})

export default {
  fetch: app.fetch,
  // nightly clean up, see "triggers" in wrangler.jsonc
  async scheduled(_event: ScheduledController, env: Env) {
    await cleanUp(env.DB)
  },
} satisfies ExportedHandler<Env>

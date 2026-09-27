// Login sessions, rate limits and the "must be logged in" middleware.
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv } from './env.ts'

const SESSION_DAYS = 60
const COOKIE_NAME = 'forma_session'

// --- sessions --------------------------------------------------------------
// The browser gets a random token in a cookie. We only store its SHA-256,
// so a leaked database does not leak valid logins.

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Online, Cloudflare always talks HTTPS. Plain http only happens with
// "wrangler dev", e.g. when testing on a phone in the same Wi-Fi.
const isHttps = (c: Context<AppEnv>) => new URL(c.req.url).protocol === 'https:'

export async function startSession(c: Context<AppEnv>, userId: number) {
  const token = randomToken()
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, expires.toISOString())
    .run()
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true, // JavaScript in the page can't read it
    secure: isHttps(c), // only over HTTPS; off when testing locally over http
    sameSite: 'Lax',
    path: '/',
    expires,
  })
}

export async function endSession(c: Context<AppEnv>) {
  const token = getCookie(c, COOKIE_NAME)
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  deleteCookie(c, COOKIE_NAME, { path: '/', secure: isHttps(c) })
}

// logs out every device of a user (after a password change)
export async function endAllSessions(c: Context<AppEnv>, userId: number) {
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
}

// Sets c.var.userId or answers with 401.
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return c.json({ error: 'Nicht eingeloggt.' }, 401)

  const row = await c.env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .bind(await sha256(token))
    .first<{ user_id: number; expires_at: string }>()

  if (!row || new Date(row.expires_at) < new Date()) {
    return c.json({ error: 'Sitzung abgelaufen. Bitte melde dich neu an.' }, 401)
  }
  c.set('userId', row.user_id)
  await next()
}

// --- rate limits -------------------------------------------------------------
// A Worker has no memory shared between requests, so the counters live in D1.

// Counts one request for `key`; false when more than `max` happened in the window.
export async function countRequest(c: Context<AppEnv>, key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  const row = await c.env.DB.prepare(
    `INSERT INTO rate_limits (key, count, since) VALUES (?1, 1, ?2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN since < ?3 THEN 1 ELSE count + 1 END,
       since = CASE WHEN since < ?3 THEN ?2 ELSE since END
     RETURNING count`,
  )
    .bind(key, now, now - windowMs)
    .first<{ count: number }>()
  return (row?.count ?? 0) <= max
}

// how many requests for `key` happened in the window, without counting a new one
export async function requestCount(c: Context<AppEnv>, key: string, windowMs: number): Promise<number> {
  const row = await c.env.DB.prepare('SELECT count FROM rate_limits WHERE key = ? AND since >= ?')
    .bind(key, Date.now() - windowMs)
    .first<{ count: number }>()
  return row?.count ?? 0
}

export async function clearRequests(c: Context<AppEnv>, key: string) {
  await c.env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run()
}

// Middleware version: limit per IP address (or per user with keyOf).
export function rateLimit(name: string, max: number, windowMs: number, keyOf?: (c: Context<AppEnv>) => string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    // Cloudflare sets CF-Connecting-IP to the real visitor address; it can't be faked
    const who = keyOf ? keyOf(c) : (c.req.header('CF-Connecting-IP') ?? 'local')
    if (!(await countRequest(c, `${name}:${who}`, max, windowMs))) {
      return c.json({ error: 'Zu viele Anfragen. Bitte warte kurz und versuch es dann noch mal.' }, 429)
    }
    await next()
  }
}

// Runs every night (see "triggers" in wrangler.jsonc).
export async function cleanUp(db: D1Database) {
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(new Date().toISOString()),
    db.prepare('DELETE FROM rate_limits WHERE since < ?').bind(Date.now() - 24 * 60 * 60 * 1000),
  ])
}

// Passwords, login sessions, rate limits and the "must be logged in" middleware.
import { randomBytes, scrypt, timingSafeEqual, createHash, type ScryptOptions } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { db } from './db.ts'

const SESSION_DAYS = 60
export const COOKIE_NAME = 'forma_session'

// --- passwords -------------------------------------------------------------
// scrypt is a slow hash made for passwords. It runs async, so hashing
// does not block other requests. Stored as "s2:salt:hash".
// Old "salt:hash" values (Node default settings) still work.

const SCRYPT: ScryptOptions = { N: 2 ** 16, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }

function scryptAsync(password: string, salt: string, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, options, (error, key) => (error ? reject(error) : resolve(key))),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = await scryptAsync(password, salt, SCRYPT)
  return `s2:${salt}:${hash.toString('hex')}`
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  const [salt, hash, options] = parts[0] === 's2' ? [parts[1], parts[2], SCRYPT] : [parts[0], parts[1], {}]
  const test = await scryptAsync(password, salt, options)
  return timingSafeEqual(test, Buffer.from(hash, 'hex'))
}

// Used when the email does not exist, so a login takes the same time either way
// (otherwise the response time would reveal who has an account).
export const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'))

// --- sessions --------------------------------------------------------------
// The browser gets a random token in a cookie. We only store its SHA-256,
// so a leaked database does not leak valid logins.

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function startSession(res: Response, userId: number) {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token),
    userId,
    expires.toISOString(),
  )
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // JavaScript in the page can't read it
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
  })
}

export function endSession(req: Request, res: Response) {
  const token = readCookie(req, COOKIE_NAME)
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
  res.clearCookie(COOKIE_NAME)
}

// logs out every device of a user (after a password change)
export function endAllSessions(userId: number) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie ?? ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key !== name) continue
    try {
      return decodeURIComponent(rest.join('='))
    } catch {
      return null // broken cookie
    }
  }
  return null
}

// Adds req.userId or answers with 401.
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = readCookie(req, COOKIE_NAME)
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' })

  const row = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(sha256(token)) as { user_id: number; expires_at: string } | undefined

  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Sitzung abgelaufen' })
  }
  req.userId = row.user_id
  next()
}

// --- rate limits -------------------------------------------------------------
// Counts requests per key in a time window. Kept in memory,
// which is fine for a single small server.

const hits = new Map<string, { count: number; since: number }>()

export function rateLimit(name: string, max: number, windowMs: number, keyOf = (req: Request) => req.ip ?? '') {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${keyOf(req)}`
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || now - entry.since > windowMs) {
      hits.set(key, { count: 1, since: now })
    } else if (++entry.count > max) {
      return res.status(429).json({ error: 'Zu viele Anfragen. Bitte warte kurz und versuch es dann noch mal.' })
    }
    next()
  }
}

// Failed logins per email: max 10 in 15 minutes, no matter from which IP.
const failed = new Map<string, { count: number; since: number }>()
const LOGIN_WINDOW_MS = 15 * 60 * 1000

export function tooManyFailedLogins(email: string): boolean {
  const entry = failed.get(email)
  return Boolean(entry && Date.now() - entry.since < LOGIN_WINDOW_MS && entry.count >= 10)
}

export function recordFailedLogin(email: string) {
  const entry = failed.get(email)
  if (!entry || Date.now() - entry.since > LOGIN_WINDOW_MS) failed.set(email, { count: 1, since: Date.now() })
  else entry.count++
}

export function clearFailedLogins(email: string) {
  failed.delete(email)
}

// Housekeeping every 10 minutes: forget old counters, delete expired sessions.
function cleanUp() {
  const now = Date.now()
  for (const map of [hits, failed]) {
    for (const [key, entry] of map) if (now - entry.since > 60 * 60 * 1000) map.delete(key)
  }
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString())
}
cleanUp()
setInterval(cleanUp, 10 * 60 * 1000).unref()

declare module 'express-serve-static-core' {
  interface Request {
    userId: number
  }
}

// Passwords, login sessions and the "must be logged in" middleware.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { db } from './db.ts'

const SESSION_DAYS = 90
const COOKIE_NAME = 'forma_session'

// --- passwords -------------------------------------------------------------
// scrypt is a slow hash made for passwords. We store "salt:hash".

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function checkPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const test = scryptSync(password, salt, 64)
  return timingSafeEqual(test, Buffer.from(hash, 'hex'))
}

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

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie ?? ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
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

// --- brute force protection ------------------------------------------------
// Max 10 failed logins per email + IP in 15 minutes. Kept in memory,
// which is fine for a single small server.

const failed = new Map<string, { count: number; since: number }>()
const WINDOW_MS = 15 * 60 * 1000

export function tooManyAttempts(key: string): boolean {
  const entry = failed.get(key)
  if (!entry || Date.now() - entry.since > WINDOW_MS) return false
  return entry.count >= 10
}

export function recordFailedAttempt(key: string) {
  const entry = failed.get(key)
  if (!entry || Date.now() - entry.since > WINDOW_MS) {
    failed.set(key, { count: 1, since: Date.now() })
  } else {
    entry.count++
  }
}

export function clearAttempts(key: string) {
  failed.delete(key)
}

declare module 'express-serve-static-core' {
  interface Request {
    userId: number
  }
}

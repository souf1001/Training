// Sets a new random password for an account and logs it out everywhere.
// Usage on the server:  npm run reset-password -- person@example.com
import { randomBytes } from 'node:crypto'
import { db } from './db.ts'
import { endAllSessions, hashPassword } from './auth.ts'

const email = String(process.argv[2] ?? '').trim().toLowerCase()
const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined

if (!user) {
  console.error(`Kein Konto mit der E-Mail "${email}" gefunden.`)
  process.exit(1)
}

const password = randomBytes(9).toString('base64url') // 12 characters
db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(password), user.id)
endAllSessions(user.id)
console.log(`Neues Passwort für ${email}: ${password}`)
console.log('Bitte nach dem Einloggen unter Profil → Passwort ändern ersetzen.')
process.exit(0)

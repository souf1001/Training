// Sets a new random password for an account and logs it out everywhere.
// Usage:  npm run reset-password -- person@example.com
// (add --local to change the local test database instead of the online one)
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { hashPassword } from '../worker/password.ts'

const email = String(process.argv[2] ?? '').trim().toLowerCase()
const where = process.argv.includes('--local') ? '--local' : '--remote'

if (!/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(email)) {
  console.error('Bitte eine E-Mail angeben: npm run reset-password -- person@beispiel.de')
  process.exit(1)
}

// runs SQL on the D1 database with wrangler (the Cloudflare command line tool)
function d1(sql: string): { results: unknown[] }[] {
  const output = execFileSync('npx', ['wrangler', 'd1', 'execute', 'forma', where, '--json', '--command', sql], { encoding: 'utf8' })
  return JSON.parse(output)
}

// the email is checked above (no quotes possible), the hash only contains hex digits and "$"
const [found] = d1(`SELECT id FROM users WHERE email = '${email}'`)
if (!found?.results.length) {
  console.error(`Kein Konto mit der E-Mail "${email}" gefunden.`)
  process.exit(1)
}

const password = randomBytes(9).toString('base64url') // 12 characters
// same strength as the Worker uses (PASSWORD_ITERATIONS in wrangler.jsonc)
const rounds = readFileSync('wrangler.jsonc', 'utf8').match(/"PASSWORD_ITERATIONS":\s*"(\d+)"/)?.[1]
const hash = await hashPassword(password, Number(rounds) || undefined)
d1(`UPDATE users SET password_hash = '${hash}' WHERE email = '${email}';
    DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = '${email}');`)

console.log(`Neues Passwort für ${email}: ${password}`)
console.log('Bitte nach dem Einloggen unter Profil → Passwort ändern ersetzen.')

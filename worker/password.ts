// Password hashing with PBKDF2-SHA256 from the Web Crypto API.
// Works in Cloudflare Workers and in Node (used by scripts/reset-password.ts).
// Stored as "pbkdf2$<rounds>$<salt hex>$<hash hex>", so the rounds can be
// raised later without breaking old passwords.

// Cloudflare Workers accept at most 100000 PBKDF2 rounds.
export const MAX_ITERATIONS = 100_000

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex: string): Uint8Array<ArrayBuffer> => new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)))

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

export async function hashPassword(password: string, iterations = MAX_ITERATIONS): Promise<string> {
  const rounds = Math.min(Math.max(Math.floor(iterations), 10_000), MAX_ITERATIONS)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${rounds}$${toHex(salt)}$${toHex(await derive(password, salt, rounds))}`
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, rounds, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2' || !rounds || !salt || !hash) return false
  const test = await derive(password, fromHex(salt), Number(rounds))
  const expected = fromHex(hash)
  // compare every byte, so the time taken does not reveal where the first difference is
  let difference = test.length ^ expected.length
  for (let i = 0; i < test.length; i++) difference |= test[i] ^ (expected[i] ?? 0)
  return difference === 0
}

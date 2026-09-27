import { describe, expect, it } from 'vitest'
import { checkPassword, hashPassword, MAX_ITERATIONS } from './password'

describe('password hashing', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('richtig123', 20_000)
    expect(stored).toMatch(/^pbkdf2\$20000\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
    expect(await checkPassword('richtig123', stored)).toBe(true)
    expect(await checkPassword('falsch123', stored)).toBe(false)
  })

  it('uses a new salt every time', async () => {
    expect(await hashPassword('gleich123', 20_000)).not.toBe(await hashPassword('gleich123', 20_000))
  })

  it('never goes above the Cloudflare limit and rejects broken values', async () => {
    expect(await hashPassword('x', 999_999)).toContain(`$${MAX_ITERATIONS}$`)
    expect(await checkPassword('x', 'not-a-hash')).toBe(false)
  })
})

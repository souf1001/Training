import { describe, expect, it } from 'vitest'
import { parseFoodText } from './foodParser'
import { parseJson } from './ai'

describe('parseFoodText', () => {
  it('reads amounts, counts and number words', () => {
    const { items, unknown } = parseFoodText('200g Reis, 2 Eier und eine Banane')
    expect(unknown).toEqual([])
    expect(items).toHaveLength(3)
    expect(items[0].grams).toBe(200)
    expect(items[1].amount).toMatch(/^2 /)
    expect(items[2].amount).toMatch(/^1 /)
  })

  it('keeps decimal commas together', () => {
    const { items } = parseFoodText('0,5 l Milch')
    expect(items).toHaveLength(1)
    expect(items[0].grams).toBe(500)
  })

  it('splits "mit" into two foods, but not inside a known dish', () => {
    expect(parseFoodText('Skyr mit Heidelbeeren').items).toHaveLength(2)
    expect(parseFoodText('Kaffee mit Milch').items).toHaveLength(1)
  })

  it('does not read "ein" as egg', () => {
    const { items, unknown } = parseFoodText('ein Stück Seife')
    expect(items).toHaveLength(0)
    expect(unknown).toHaveLength(1)
  })

  it('uses a typical portion when no amount is given', () => {
    const { items } = parseFoodText('Döner')
    expect(items[0].kcal).toBeGreaterThan(500)
  })
})

describe('parseJson', () => {
  it('finds JSON inside a chatty answer', () => {
    expect(parseJson('Klar! ```json\n{"items":[]}\n```')).toEqual({ items: [] })
  })
})

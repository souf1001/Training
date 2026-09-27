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

  it('prefers the unit you typed over the food\'s own unit', () => {
    expect(parseFoodText('1 EL Butter').items[0].grams).toBe(15)
    expect(parseFoodText('1 Becher Sahne').items[0].grams).toBe(200)
    expect(parseFoodText('eine Tafel Schokolade').items[0].grams).toBe(100)
  })

  it('reads fractions, number words and counts after the food', () => {
    expect(parseFoodText('eine halbe Pizza').items[0].grams).toBe(190)
    expect(parseFoodText('1 1/2 Brötchen').items[0].amount).toMatch(/^1,5 /)
    expect(parseFoodText('zehn Eier').items[0].amount).toMatch(/^10 /)
    expect(parseFoodText('Ei 3').items[0].amount).toMatch(/^3 /)
  })

  it('counts a piece of pizza as a slice', () => {
    expect(parseFoodText('ein Stück Pizza').items[0].kcal).toBeLessThan(200)
  })

  it('finds two foods without a separator and ignores filler words', () => {
    expect(parseFoodText('Nutella Brot').items).toHaveLength(2)
    const doener = parseFoodText('Döner mit allem')
    expect(doener.items).toHaveLength(1)
    expect(doener.unknown).toEqual([])
  })

  it('does not mistake "1,5%" for an amount', () => {
    const { items } = parseFoodText('1,5% Milch')
    expect(items[0].name).toContain('1,5')
    expect(items[0].grams).toBe(250)
  })

  it('writes units in plural', () => {
    expect(parseFoodText('2 Gläser Orangensaft').items[0].amount).toBe('2 Gläser')
    expect(parseFoodText('2 Scheiben Vollkornbrot').items[0].amount).toBe('2 Scheiben')
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

  it('handles thinking blocks, braces in prose, trailing commas and plain arrays', () => {
    expect(parseJson('<think>maybe {x}</think>{"items":[1]}')).toEqual({ items: [1] })
    expect(parseJson('{"items":[2]} Hinweis: {geschätzt}')).toEqual({ items: [2] })
    expect(parseJson('{"items":[3,],}')).toEqual({ items: [3] })
    expect(parseJson('[{"name":"Ei"}]')).toEqual({ items: [{ name: 'Ei' }] })
  })
})

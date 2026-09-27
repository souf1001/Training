// Turns text like "200g Reis, 2 Eier und eine Banane" into food entries
// using the built-in food table. Works offline and without AI.
import { foods } from '../data/foods'
import type { Food, Macros } from './types'

export interface ParsedFood extends Macros {
  name: string
  amount: string
  grams: number
  per100: Macros
}

export interface ParseResult {
  items: ParsedFood[]
  unknown: string[] // parts we could not match
}

const NUMBER_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einen: 1, einem: 1, einer: 1,
  zwei: 2, drei: 3, vier: 4, 'fünf': 5, sechs: 6,
  halb: 0.5, halbe: 0.5, halben: 0.5, halbes: 0.5,
}

// generic unit sizes, used when the food has no own unit
const UNITS: Record<string, number> = {
  el: 15, 'esslöffel': 15, tl: 5, 'teelöffel': 5,
  glas: 250, tasse: 200, becher: 200, flasche: 500, dose: 330,
  handvoll: 30, portion: 0, scheibe: 0, scheiben: 0, 'stück': 0, stk: 0,
}

// longest aliases first, so "cola zero" wins over "cola"
const ALIASES = foods
  .flatMap((food) => [food.name.toLowerCase(), ...food.aliases].map((alias) => ({ alias, food })))
  .sort((a, b) => b.alias.length - a.alias.length)

function matchAlias(text: string): { alias: string; food: Food } | null {
  const t = ` ${normalize(text)} `
  for (const match of ALIASES) {
    const { alias } = match
    if (t.includes(` ${alias} `)) return match
    // simple plurals ("Nudeln", "Steaks"); not for short words, otherwise "ein" would be "ei" + n
    if (alias.length >= 4 && (t.includes(` ${alias}n `) || t.includes(` ${alias}s `))) return match
  }
  return null
}

export function findFood(text: string): Food | null {
  return matchAlias(text)?.food ?? null
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[(),.!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseFoodText(text: string): ParseResult {
  const parts = text
    // split at "," but not inside numbers like "0,5 l"
    .split(/(?<!\d),|,(?!\d)|;|\+|\n| und /i)
    .flatMap(splitAtWith)
    .map((p) => p.trim())
    .filter(Boolean)

  const items: ParsedFood[] = []
  const unknown: string[] = []
  for (const part of parts) {
    const item = parsePart(part)
    if (item) items.push(item)
    else unknown.push(part)
  }
  return { items, unknown }
}

// "Skyr mit Heidelbeeren" are two foods, but "Kaffee mit Milch" is one entry in the table
function splitAtWith(part: string): string[] {
  if (!/ mit /i.test(part)) return [part]
  const match = matchAlias(part)
  if (match && match.alias.includes(' mit ')) return [part]
  return part.split(/ mit /i)
}

function parsePart(part: string): ParsedFood | null {
  const food = findFood(part)
  if (!food) return null
  // keep decimal numbers ("0,5 l" -> "0.5 l"), drop other punctuation
  const text = part
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[(),!?]|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  let grams: number | null = null
  let amount = ''

  // "200g", "200 g", "0.5 l", "250ml", "1,5 kg"
  const weight = text.match(/(\d+(?:\.\d+)?)\s*(kg|g|gramm|ml|l|liter)\b/)
  if (weight) {
    const value = parseFloat(weight[1])
    const unit = weight[2]
    grams = unit === 'kg' || unit === 'l' || unit === 'liter' ? value * 1000 : value
    amount = `${formatNumber(grams)} ${unit === 'ml' || unit === 'l' || unit === 'liter' ? 'ml' : 'g'}`
  } else {
    // "2 Eier", "eine Banane", "2 Scheiben Brot", "1 EL Öl"
    const count = text.match(/^(\d+(?:\.\d+)?|[a-zäöü]+)\s*([a-zäöü]+)?/)
    let n: number | null = null
    if (count) n = /\d/.test(count[1]) ? parseFloat(count[1]) : (NUMBER_WORDS[count[1]] ?? null)

    const unitWord = Object.keys(UNITS).find((u) => new RegExp(`\\b${u}\\b`).test(text))
    const unitGrams = unitWord && UNITS[unitWord] > 0 && !food.unit ? UNITS[unitWord] : null

    if (n != null) {
      const perPiece = unitGrams ?? food.unit?.grams ?? food.defaultGrams
      grams = n * perPiece
      const unitName = unitWord && unitGrams ? unitWord.toUpperCase() : food.unit?.name
      amount = unitName ? `${formatNumber(n)} ${unitName}` : `${formatNumber(grams)} g`
    }
  }

  if (grams == null) {
    grams = food.defaultGrams
    amount = food.unit && food.unit.grams === food.defaultGrams ? `1 ${food.unit.name}` : `${grams} g`
  }

  const factor = grams / 100
  return {
    name: food.name,
    amount,
    grams,
    per100: { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat },
    kcal: Math.round(food.kcal * factor),
    protein: round1(food.protein * factor),
    carbs: round1(food.carbs * factor),
    fat: round1(food.fat * factor),
  }
}

// Suggestions while typing a single food name.
export function searchFoods(query: string, limit = 8): Food[] {
  const q = normalize(query)
  if (q.length < 2) return []
  const starts = foods.filter((f) => f.name.toLowerCase().startsWith(q) || f.aliases.some((a) => a.startsWith(q)))
  const contains = foods.filter((f) => !starts.includes(f) && (f.name.toLowerCase().includes(q) || f.aliases.some((a) => a.includes(q))))
  return [...starts, ...contains].slice(0, limit)
}

export function macrosFor(food: Pick<Food, 'kcal' | 'protein' | 'carbs' | 'fat'>, grams: number): Macros {
  const factor = grams / 100
  return {
    kcal: Math.round(food.kcal * factor),
    protein: round1(food.protein * factor),
    carbs: round1(food.carbs * factor),
    fat: round1(food.fat * factor),
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function formatNumber(n: number) {
  return String(Math.round(n * 10) / 10).replace('.', ',')
}

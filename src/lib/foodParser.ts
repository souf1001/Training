// Turns text like "200g Reis, 2 Eier und eine Banane" into food entries
// using the built-in food table. Works offline and without AI.
import { foods } from '../data/foods'
import { formatNumber, round1 } from './format'
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
  ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1,
  zwei: 2, drei: 3, vier: 4, 'fünf': 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12,
  halb: 0.5, halbe: 0.5, halben: 0.5, halbes: 0.5, anderthalb: 1.5,
}

// Generic unit sizes in gram/ml. 0 = "one piece" of the food (its own unit).
const UNITS: Record<string, number> = {
  el: 15, 'esslöffel': 15, tl: 5, 'teelöffel': 5,
  glas: 250, 'gläser': 250, tasse: 200, tassen: 200, becher: 200, flasche: 500, flaschen: 500,
  dose: 330, dosen: 330, tafel: 100, 'tüte': 150, schale: 150, handvoll: 30, prise: 1,
  portion: 0, portionen: 0, scheibe: 0, scheiben: 0, 'stück': 0, stk: 0, riegel: 0, kugel: 0, kugeln: 0,
}

// how units are shown: [one, many]
const UNIT_LABEL: Record<string, [string, string]> = {
  el: ['EL', 'EL'], 'esslöffel': ['EL', 'EL'], tl: ['TL', 'TL'], 'teelöffel': ['TL', 'TL'],
  glas: ['Glas', 'Gläser'], 'gläser': ['Glas', 'Gläser'], tasse: ['Tasse', 'Tassen'], tassen: ['Tasse', 'Tassen'],
  becher: ['Becher', 'Becher'], flasche: ['Flasche', 'Flaschen'], flaschen: ['Flasche', 'Flaschen'],
  dose: ['Dose', 'Dosen'], dosen: ['Dose', 'Dosen'], tafel: ['Tafel', 'Tafeln'], 'tüte': ['Tüte', 'Tüten'],
  schale: ['Schale', 'Schalen'], handvoll: ['Handvoll', 'Handvoll'], prise: ['Prise', 'Prisen'],
}

// plural of the first word of a food's own unit ("Scheibe" -> "Scheiben", "Glas (250 ml)" -> "Gläser (250 ml)")
const PLURALS: Record<string, string> = {
  Scheibe: 'Scheiben', Glas: 'Gläser', Tasse: 'Tassen', Flasche: 'Flaschen', Dose: 'Dosen', Kugel: 'Kugeln',
  Portion: 'Portionen', Tafel: 'Tafeln', Packung: 'Packungen', Schale: 'Schalen', Tüte: 'Tüten', Handvoll: 'Handvoll',
}

function unitName(name: string, count: number): string {
  if (count === 1) return name
  const [first, ...rest] = name.split(' ')
  return [PLURALS[first] ?? first, ...rest].join(' ')
}

// words that are not food ("Döner mit allem")
const FILLER = /^(allem|alles|etwas|bisschen|ein bisschen|dazu|noch)$/

// longest aliases first, so "cola zero" wins over "cola"
const ALIASES = foods
  .flatMap((food) => [food.name.toLowerCase(), ...food.aliases].map((alias) => ({ alias, food })))
  .sort((a, b) => b.alias.length - a.alias.length)

// for matching: lowercase, no punctuation ("Milch 1,5%" -> "milch 1 5")
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[(),.!?%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// finds the longest known food name in the text; returns the matched words too
function matchAlias(text: string): { food: Food; matched: string } | null {
  const t = ` ${normalize(text)} `
  for (const { alias, food } of ALIASES) {
    if (t.includes(` ${alias} `)) return { food, matched: alias }
    // simple plurals ("Nudeln", "Steaks"); not for short words, otherwise "ein" would be "ei" + n
    if (alias.length >= 4) {
      for (const plural of [`${alias}n`, `${alias}s`]) if (t.includes(` ${plural} `)) return { food, matched: plural }
    }
  }
  return null
}

export function parseFoodText(text: string): ParseResult {
  const parts = text
    // split at "," but not inside numbers like "0,5 l"
    .split(/(?<!\d),|,(?!\d)|;|\+|\n| und /i)
    .flatMap(splitAtWith)
    .map((p) => p.trim())
    .filter((p) => p && !FILLER.test(p.toLowerCase()))

  const items: ParsedFood[] = []
  const unknown: string[] = []
  for (const part of parts) {
    const found = parsePart(part)
    if (found.length > 0) items.push(...found)
    else unknown.push(part)
  }
  return { items, unknown }
}

// "Skyr mit Heidelbeeren" are two foods, but "Kaffee mit Milch" is one entry in the table
function splitAtWith(part: string): string[] {
  if (!/ mit /i.test(part)) return [part]
  const match = matchAlias(part)
  if (match && match.matched.includes(' mit ')) return [part]
  return part.split(/ mit /i)
}

// One part can hold more foods without a separator ("Nutella Brot").
// Only the first food gets the amount, the others their typical portion.
function parsePart(part: string): ParsedFood[] {
  const first = matchAlias(part)
  if (!first) return []
  const result = [toParsedFood(first.food, readAmount(part, first.food))]

  let rest = ` ${normalize(part)} `.replace(` ${first.matched} `, ' ')
  for (let i = 0; i < 2; i++) {
    const next = matchAlias(rest)
    if (!next) break
    result.push(toParsedFood(next.food, readAmount('', next.food)))
    rest = rest.replace(` ${next.matched} `, ' ')
  }
  return result
}

interface Amount {
  grams: number
  label: string
}

function readAmount(part: string, food: Food): Amount {
  const text = part
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2') // "0,5 l" -> "0.5 l"
    .replace(/\d+(\.\d+)?\s*%/g, ' ') // "1,5% Milch": the 1.5 is not an amount
    .replace(/(\d+)\s+(\d+)\/(\d+)/g, (_, a, b, c) => String(Number(a) + Number(b) / Number(c))) // "1 1/2"
    .replace(/(\d+)\/(\d+)/g, (_, a, b) => String(Number(a) / Number(b))) // "1/2"
    .replace(/½/g, '0.5')
    .replace(/\bein(e|en|es)? halbe(n|s)?\b/g, 'halbe') // "eine halbe Pizza"
    .replace(/[(),!?]|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // "200g", "200 g", "0.5 l", "250ml", "1.5 kg"
  const weight = text.match(/(\d+(?:\.\d+)?)\s*(kg|g|gramm|ml|l|liter)\b/)
  if (weight) {
    const value = parseFloat(weight[1])
    const liquid = ['ml', 'l', 'liter'].includes(weight[2])
    const grams = ['kg', 'l', 'liter'].includes(weight[2]) ? value * 1000 : value
    return { grams, label: `${formatNumber(grams)} ${liquid ? 'ml' : 'g'}` }
  }

  // a count anywhere: "2 Eier", "Ei 3", "2x Toast", "zwei Bananen"
  const digits = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*x?(?=\s|$)/)
  const word = text.split(' ').find((w) => w in NUMBER_WORDS)
  const unitWord = text.split(' ').find((w) => w in UNITS)
  const count = digits ? parseFloat(digits[1]) : word ? NUMBER_WORDS[word] : unitWord ? 1 : null
  if (count == null) {
    const label = food.unit && food.unit.grams === food.defaultGrams ? `1 ${food.unit.name}` : `${food.defaultGrams} g`
    return { grams: food.defaultGrams, label }
  }

  const piece = pieceSize(food, unitWord)
  return { grams: count * piece.grams, label: `${formatNumber(count, 2)} ${unitName(piece.name, count)}` }
}

// How big "one" is: the food's own unit if the words match ("2 Scheiben Brot"),
// else the generic unit ("1 Becher Sahne"), else one piece of the food.
function pieceSize(food: Food, unitWord: string | undefined): { grams: number; name: string } {
  const own = food.unit
  const ownName = own?.name.toLowerCase() ?? ''
  if (unitWord && own && (ownName.startsWith(unitWord) || unitWord.startsWith(ownName.split(' ')[0]))) {
    return { grams: own.grams, name: own.name }
  }
  if (unitWord && UNITS[unitWord] > 0) {
    return { grams: UNITS[unitWord], name: UNIT_LABEL[unitWord]?.[0] ?? unitWord }
  }
  // "ein Stück Pizza" is a slice, not the whole pizza
  if (unitWord && own && ['pizza', 'kuchen', 'torte'].includes(ownName)) {
    return { grams: Math.round(own.grams / 8), name: 'Stück' }
  }
  if (own) return { grams: own.grams, name: own.name }
  return { grams: food.defaultGrams, name: `Portion (${food.defaultGrams} g)` }
}

function toParsedFood(food: Food, amount: Amount): ParsedFood {
  const per100 = { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat }
  return { name: food.name, amount: amount.label, grams: amount.grams, per100, ...macrosFor(per100, amount.grams) }
}

// Suggestions while typing a single food name.
export function searchFoods(query: string, limit = 8): Food[] {
  const q = normalize(query)
  if (q.length < 2) return []
  const starts = foods.filter((f) => f.name.toLowerCase().startsWith(q) || f.aliases.some((a) => a.startsWith(q)))
  const contains = foods.filter((f) => !starts.includes(f) && (f.name.toLowerCase().includes(q) || f.aliases.some((a) => a.includes(q))))
  return [...starts, ...contains].slice(0, limit)
}

export function macrosFor(food: Macros, grams: number): Macros {
  const factor = grams / 100
  return {
    kcal: Math.round(food.kcal * factor),
    protein: round1(food.protein * factor),
    carbs: round1(food.carbs * factor),
    fat: round1(food.fat * factor),
  }
}

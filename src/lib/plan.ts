// Builds a weekly training plan from the profile. No AI needed:
// 1. pick a split that fits the number of training days
// 2. fill each day with exercises for its movement patterns (depending on equipment + level)
// 3. choose sets, reps, effort and rest for the goal
// 4. spread cardio over the week
import { exercises } from '../data/exercises'
import { CARDIO_TYPES } from './labels'
import { formatKg } from './format'
import { zone2 } from './nutrition'
import type {
  CardioSession,
  CardioType,
  Equipment,
  Exercise,
  Experience,
  Goal,
  Pattern,
  Plan,
  PlanDay,
  PlannedExercise,
  Profile,
  WeeklyLoad,
} from './types'

interface DayTemplate {
  title: string
  focus: string
  // most important first; the end is cut off when time is short
  patterns: Pattern[]
  // 1 = second version of the same day, picks different exercises
  variant: number
}

const FULL_A: DayTemplate = {
  title: 'Ganzkörper A',
  focus: 'Beine, Brust, Rücken',
  patterns: ['squat', 'pushH', 'pullH', 'hinge', 'shoulders', 'core', 'biceps', 'triceps', 'calves'],
  variant: 0,
}
const FULL_B: DayTemplate = {
  title: 'Ganzkörper B',
  focus: 'Po, Schultern, Rücken',
  patterns: ['hinge', 'pushV', 'pullV', 'lunge', 'core', 'glutes', 'rearDelts', 'triceps', 'biceps'],
  variant: 1,
}
const FULL_C: DayTemplate = {
  title: 'Ganzkörper C',
  focus: 'Beine, Brust, Latissimus',
  patterns: ['lunge', 'pushH', 'pullV', 'squat', 'rearDelts', 'core', 'biceps', 'triceps'],
  variant: 2,
}
const UPPER_A: DayTemplate = {
  title: 'Oberkörper A',
  focus: 'Brust, Rücken, Arme',
  patterns: ['pushH', 'pullH', 'pushV', 'pullV', 'shoulders', 'biceps', 'triceps', 'rearDelts', 'core'],
  variant: 0,
}
const UPPER_B: DayTemplate = {
  title: 'Oberkörper B',
  focus: 'Schultern, Latissimus, Arme',
  patterns: ['pullV', 'pushV', 'pullH', 'pushH', 'rearDelts', 'triceps', 'biceps', 'shoulders', 'core'],
  variant: 1,
}
const LOWER_A: DayTemplate = {
  title: 'Unterkörper A',
  focus: 'Beine & Po',
  patterns: ['squat', 'hinge', 'lunge', 'glutes', 'calves', 'core', 'squat', 'hinge'],
  variant: 0,
}
const LOWER_B: DayTemplate = {
  title: 'Unterkörper B',
  focus: 'Po & Beinbeuger',
  patterns: ['hinge', 'squat', 'glutes', 'lunge', 'calves', 'core', 'hinge', 'squat'],
  variant: 1,
}
const PUSH: DayTemplate = {
  title: 'Push',
  focus: 'Brust, Schultern, Trizeps',
  patterns: ['pushH', 'pushV', 'pushH', 'shoulders', 'triceps', 'triceps', 'core', 'pushV'],
  variant: 0,
}
const PULL: DayTemplate = {
  title: 'Pull',
  focus: 'Rücken & Bizeps',
  patterns: ['pullV', 'pullH', 'pullV', 'rearDelts', 'biceps', 'biceps', 'core', 'pullH'],
  variant: 0,
}
const LEGS: DayTemplate = {
  title: 'Beine',
  focus: 'Beine, Po, Waden',
  patterns: ['squat', 'hinge', 'lunge', 'glutes', 'calves', 'core', 'squat', 'glutes'],
  variant: 0,
}

function second(day: DayTemplate): DayTemplate {
  return { ...day, title: `${day.title} 2`, variant: 1 }
}

const SPLITS: Record<number, { name: string; days: DayTemplate[] }> = {
  1: { name: 'Ganzkörper', days: [FULL_A] },
  2: { name: 'Ganzkörper A/B', days: [FULL_A, FULL_B] },
  3: { name: 'Ganzkörper A/B/C', days: [FULL_A, FULL_B, FULL_C] },
  4: { name: 'Oberkörper / Unterkörper', days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] },
  // Push and Beine use the second variant, so they differ from Oberkörper A / Unterkörper A
  5: { name: 'Ober-/Unterkörper + Push/Pull/Beine', days: [UPPER_A, LOWER_A, { ...PUSH, variant: 1 }, PULL, { ...LEGS, variant: 1 }] },
  6: { name: 'Push / Pull / Beine', days: [PUSH, PULL, LEGS, second(PUSH), second(PULL), second(LEGS)] },
}

// Beginners recover best with max. 4 strength days; extra days become cardio days.
const MAX_STRENGTH_DAYS: Record<Experience, number> = { beginner: 4, intermediate: 6, advanced: 6 }

const LEVEL_RANK: Record<Experience, number> = { beginner: 0, intermediate: 1, advanced: 2 }

// In the gym you use real gym equipment, not bands, chairs or backpacks.
const GYM_EQUIPMENT: Equipment[] = ['barbell', 'cable', 'machine', 'dumbbells', 'kettlebell', 'bench', 'pullupbar']

export function availableEquipment(p: Pick<Profile, 'location' | 'equipment'>): Set<Equipment> {
  return new Set(p.location === 'gym' ? GYM_EQUIPMENT : p.equipment)
}

// Heavier, more adjustable equipment first: it lets you progress for longer.
function equipmentTier(e: Exercise): number {
  if (e.equipment.some((q) => q === 'barbell' || q === 'cable' || q === 'machine')) return 0
  if (e.equipment.some((q) => q === 'dumbbells' || q === 'kettlebell' || q === 'pullupbar')) return 1
  if (e.equipment.includes('bands')) return 2
  return 3
}

// All exercises of a pattern you can do with your equipment and level, best first.
export function candidates(pattern: Pattern, equipment: Set<Equipment>, level: Experience): Exercise[] {
  return exercises
    .filter((e) => e.pattern === pattern && e.equipment.every((item) => equipment.has(item)) && LEVEL_RANK[e.level] <= LEVEL_RANK[level])
    .sort((a, b) => equipmentTier(a) - equipmentTier(b)) // stable: keeps the file order inside a tier
}

function exercisesPerSession(minutes: number): number {
  if (minutes <= 30) return 4
  if (minutes <= 45) return 5
  if (minutes <= 60) return 6
  if (minutes <= 75) return 7
  return 8
}

// Core work on at most 2 days a week is plenty.
const MAX_CORE_DAYS = 2

function buildDay(template: DayTemplate, p: Profile, coreDays: { count: number }): PlannedExercise[] {
  const equipment = availableEquipment(p)
  const count = exercisesPerSession(p.sessionMinutes)
  const used = new Set<string>()
  const planned: PlannedExercise[] = []
  let hasCore = false

  for (const pattern of template.patterns) {
    if (planned.length >= count) break
    if (pattern === 'core' && (hasCore || coreDays.count >= MAX_CORE_DAYS)) continue
    let options = candidates(pattern, equipment, p.experience).filter((e) => !used.has(e.id))
    // start the day with a big multi-joint exercise (not e.g. a leg curl)
    if (planned.length === 0 && options.some((e) => e.compound)) options = options.filter((e) => e.compound)
    if (options.length === 0) continue
    // rotate only between the best few options, so variety never means a weak exercise
    const pool = options.slice(0, 3)
    const exercise = pool[template.variant % pool.length]
    used.add(exercise.id)
    planned.push(prescribe(exercise, p))
    if (pattern === 'core') hasCore = true
  }
  if (hasCore) coreDays.count++
  return planned
}

// Sets, reps, effort and rest for one exercise.
export function prescribe(e: Exercise, p: Pick<Profile, 'goal' | 'experience'>): PlannedExercise {
  const level = p.experience
  const heavyGoal = p.goal === 'build' || p.goal === 'bulk'
  const bodyweightOnly = e.equipment.every((item) => ['chair', 'bed', 'towel'].includes(item))

  let repsMin: number
  let repsMax: number
  if (e.timed) {
    ;[repsMin, repsMax] = { beginner: [20, 40], intermediate: [30, 60], advanced: [45, 90] }[level]
  } else if (bodyweightOnly) {
    ;[repsMin, repsMax] = e.compound ? [8, 15] : [12, 20]
  } else if (e.compound) {
    ;[repsMin, repsMax] = heavyGoal ? [6, 10] : [8, 12]
  } else {
    ;[repsMin, repsMax] = p.goal === 'lose' ? [12, 15] : [10, 15]
  }

  const sets = e.compound ? { beginner: 3, intermediate: 3, advanced: 4 }[level] : { beginner: 2, intermediate: 3, advanced: 3 }[level]

  // RIR = reps in reserve. 2 means: stop when you could still do 2 more clean reps.
  const rir = e.compound ? { beginner: 3, intermediate: 2, advanced: 1 }[level] : { beginner: 2, intermediate: 1, advanced: 1 }[level]

  // Going to failure is fine for small and bodyweight exercises, but not for heavy
  // barbell lifts (technique breaks down) or core work (the lower back takes over).
  const lastSetToFailure = level !== 'beginner' && !e.timed && e.pattern !== 'core' && (!e.compound || bodyweightOnly)

  let restSec: number
  if (e.timed) restSec = 45
  else if (e.compound) restSec = heavyGoal ? 150 : p.goal === 'lose' ? 90 : 120
  else restSec = p.goal === 'lose' ? 60 : 75

  return { exerciseId: e.id, sets, repsMin, repsMax, rir, restSec, lastSetToFailure }
}

// --- cardio ------------------------------------------------------------------

const CARDIO_BASE: Record<Goal, { sessions: number; minutes: number }> = {
  lose: { sessions: 4, minutes: 35 },
  recomp: { sessions: 3, minutes: 25 },
  build: { sessions: 2, minutes: 20 },
  bulk: { sessions: 1, minutes: 20 },
  fit: { sessions: 3, minutes: 30 },
}

const STEPS_GOAL: Record<Goal, number> = { lose: 10000, recomp: 9000, fit: 8000, build: 7000, bulk: 6000 }

const INTERVAL_TYPES: CardioType[] = ['run', 'bike', 'row', 'rope', 'hiit', 'stairs']

function cardioSessions(p: Profile): CardioSession[] {
  if (p.cardioLevel === 'none') return []
  const base = CARDIO_BASE[p.goal]
  let sessions = base.sessions
  let minutes = base.minutes
  if (p.cardioLevel === 'low') sessions = Math.max(1, Math.min(2, sessions - 1))
  if (p.cardioLevel === 'high') {
    sessions += 1
    minutes += 10
  }
  sessions = Math.min(sessions, 6)

  const types: CardioType[] = p.cardioTypes.length > 0 ? p.cardioTypes : ['walk']
  const [low, high] = zone2(p.age)
  const wantsIntervals =
    (p.goal === 'lose' || p.goal === 'fit' || p.goal === 'recomp') &&
    p.experience !== 'beginner' &&
    p.cardioLevel !== 'low' &&
    types.some((t) => INTERVAL_TYPES.includes(t))

  const result: CardioSession[] = []
  for (let i = 0; i < sessions; i++) {
    // one interval session per week, the rest easy
    if (wantsIntervals && i === 1) {
      const type = types.find((t) => INTERVAL_TYPES.includes(t))!
      result.push({
        type,
        minutes: 20,
        intensity: 'intervals',
        note: `${CARDIO_TYPES[type]}: 5 Min. locker aufwärmen, dann 8 × 30 Sek. schnell und 90 Sek. locker, 3 Min. auslaufen.`,
      })
    } else {
      const type = types[i % types.length]
      result.push({
        type,
        minutes,
        intensity: 'easy',
        note: `${CARDIO_TYPES[type]} im lockeren Tempo: Du kannst noch in ganzen Sätzen reden. Puls etwa ${low}–${high} (Zone 2).`,
      })
    }
  }
  return result
}

// --- the whole plan --------------------------------------------------------------

export function generatePlan(p: Profile): Plan {
  const chosenDays = [...new Set(p.trainingDays)].sort((a, b) => a - b)
  const strengthCount = Math.min(chosenDays.length, MAX_STRENGTH_DAYS[p.experience], 6)
  const split = SPLITS[Math.max(1, strengthCount)]

  // spread strength days over the chosen days, leftover chosen days get cardio
  const strengthDays = pickSpread(chosenDays, strengthCount)
  const coreDays = { count: 0 }
  const days: PlanDay[] = strengthDays.map((weekday, i) => {
    const template = split.days[i]
    return {
      weekday,
      title: template.title,
      focus: template.focus,
      exercises: buildDay(template, p, coreDays),
      cardio: null,
    }
  })

  // Cardio goes on chosen days without strength training first, then on free days,
  // then after strength sessions. One free day always stays a real rest day.
  const cardio = cardioSessions(p)
  const extraChosen = chosenDays.filter((d) => !strengthDays.includes(d))
  const freeDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !chosenDays.includes(d)).slice(0, -1)
  const order = [...extraChosen, ...freeDays, ...strengthDays]

  cardio.forEach((session, i) => {
    const weekday = order[i % order.length]
    const existing = days.find((d) => d.weekday === weekday)
    if (existing) {
      existing.cardio = session
    } else {
      days.push({ weekday, title: 'Cardio', focus: 'Ausdauer', exercises: [], cardio: session })
    }
  })
  days.sort((a, b) => a.weekday - b.weekday)

  return {
    createdAt: new Date().toISOString(),
    splitName: split.name,
    days,
    cardioPerWeek: cardio.length,
    stepsGoal: STEPS_GOAL[p.goal],
    notes: planNotes(p, chosenDays.length > strengthCount),
  }
}

// Picks `count` items spread as evenly as possible (e.g. Mo, Mi, Fr out of Mo–Fr).
function pickSpread<T>(items: T[], count: number): T[] {
  if (count >= items.length) return items
  const step = items.length / count
  return Array.from({ length: count }, (_, i) => items[Math.floor((i + 0.5) * step)])
}

// What a week of the plan contains; the calorie calculation needs it.
export function weeklyLoad(plan: Plan): WeeklyLoad {
  return {
    strengthSessions: plan.days.filter((d) => d.exercises.length > 0).length,
    cardioMinutes: plan.days.reduce((sum, d) => sum + (d.cardio?.minutes ?? 0), 0),
  }
}

function planNotes(p: Profile, cappedDays: boolean): string[] {
  const notes = [
    'Wärm dich 5 Minuten auf und mach vor der ersten Übung 1–2 leichte Sätze.',
    'Steigern: Schaffst du in allen Sätzen die obere Wiederholungszahl, nimm beim nächsten Mal etwas mehr Gewicht.',
    'RIR heißt „Reps in Reserve“: So viele saubere Wiederholungen könntest du am Ende des Satzes noch schaffen.',
  ]
  if (p.experience === 'beginner') {
    notes.push('Die ersten 4 Wochen geht es um Technik. Lieber leichter und sauber als schwer und wackelig.')
  }
  if (cappedDays) {
    notes.push('Als Anfänger reichen 4 Krafttage. Die übrigen Tage nutzt du für Cardio und Erholung.')
  }
  if (p.goal === 'lose' || p.goal === 'recomp') {
    notes.push('Im Kaloriendefizit hält schweres Krafttraining deine Muskeln. Das Gewicht an der Hantel möglichst halten.')
  }
  if (p.goal === 'bulk' || p.goal === 'build') {
    notes.push('Für Muskelaufbau zählt Fortschritt: Schreib jedes Training auf und versuch, dich langsam zu steigern.')
  }
  return notes
}

// --- progression ------------------------------------------------------------------

// Suggestion for today, based on the last time you did this exercise ("double progression").
export function nextTarget(planned: PlannedExercise, exercise: Exercise, last: { weight: number | null; reps: number | null }[] | undefined): string {
  if (!last || last.length === 0) {
    return exercise.timed ? 'Erstes Mal: Halte so lange, wie die Position sauber bleibt.' : 'Erstes Mal: Wähl ein Gewicht, mit dem die Technik sauber bleibt.'
  }
  const done = last.filter((s) => s.reps != null)
  if (done.length === 0) return ''
  const allTop = done.length >= planned.sets && done.every((s) => (s.reps ?? 0) >= planned.repsMax)
  const weight = Math.max(...done.map((s) => s.weight ?? 0))

  if (exercise.timed) return allTop ? 'Letztes Mal alles geschafft. Heute: 5 Sek. länger halten.' : 'Versuch heute ein paar Sekunden länger.'
  if (allTop) {
    // small jumps for light weights (dumbbells often go up in 1–2 kg steps)
    return weight > 0
      ? `Letztes Mal alle Sätze geschafft. Heute: ${formatKg(weight + (weight >= 40 ? 2.5 : weight >= 10 ? 2 : 1))} versuchen.`
      : 'Letztes Mal alle Sätze geschafft. Heute: langsamer ausführen oder eine schwerere Variante.'
  }
  return weight > 0 ? `Bleib bei ${formatKg(weight)} und versuch 1 Wiederholung mehr pro Satz.` : 'Versuch heute 1 Wiederholung mehr pro Satz.'
}

export function exerciseById(id: string): Exercise | undefined {
  return exercises.find((e) => e.id === id)
}

// Other exercises of the same pattern you could do instead.
export function alternatives(exerciseId: string, p: Profile): Exercise[] {
  const exercise = exerciseById(exerciseId)
  if (!exercise) return []
  return candidates(exercise.pattern, availableEquipment(p), p.experience).filter((e) => e.id !== exerciseId)
}

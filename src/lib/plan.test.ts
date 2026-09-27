import { describe, expect, it } from 'vitest'
import { availableEquipment, candidates, generatePlan, nextTarget } from './plan'
import { exercises } from '../data/exercises'
import { DEFAULT_PROFILE } from '../state/app'
import type { Equipment, Pattern, Profile } from './types'

const PATTERNS: Pattern[] = ['squat', 'hinge', 'lunge', 'pushH', 'pushV', 'pullH', 'pullV', 'glutes', 'core', 'biceps', 'triceps', 'shoulders', 'rearDelts', 'calves']

function profile(changes: Partial<Profile>): Profile {
  return { ...DEFAULT_PROFILE, ...changes }
}

describe('exercise library', () => {
  it('has unique ids and complete texts', () => {
    const ids = new Set(exercises.map((e) => e.id))
    expect(ids.size).toBe(exercises.length)
    for (const e of exercises) {
      expect(e.steps.length, e.id).toBeGreaterThan(0)
      expect(e.feel.length, e.id).toBeGreaterThan(0)
      expect(e.notFeel.length, e.id).toBeGreaterThan(0)
    }
  })

  const setups: [string, Equipment[]][] = [
    ['nothing', []],
    ['dumbbells', ['dumbbells']],
    ['bands', ['bands']],
    ['chair + bed + towel + backpack', ['chair', 'bed', 'towel', 'backpack']],
  ]
  for (const [name, equipment] of setups) {
    it(`covers every movement pattern at home with ${name}`, () => {
      for (const pattern of PATTERNS) {
        // side delts can't be trained without any weight; pushV and rearDelts cover the shoulders then
        if (pattern === 'shoulders' && equipment.length === 0) continue
        expect(candidates(pattern, new Set(equipment), 'beginner').length, pattern).toBeGreaterThan(0)
      }
    })
  }
})

describe('generatePlan', () => {
  it('trains on the chosen weekdays', () => {
    const plan = generatePlan(profile({ trainingDays: [0, 2, 4], cardioLevel: 'none' }))
    expect(plan.days.map((d) => d.weekday)).toEqual([0, 2, 4])
    expect(plan.splitName).toContain('Ganzkörper')
  })

  it('picks the split by number of days', () => {
    expect(generatePlan(profile({ experience: 'intermediate', trainingDays: [0, 1, 3, 4] })).splitName).toBe('Oberkörper / Unterkörper')
    expect(generatePlan(profile({ experience: 'advanced', trainingDays: [0, 1, 2, 3, 4, 5] })).splitName).toBe('Push / Pull / Beine')
  })

  it('limits beginners to 4 strength days', () => {
    const plan = generatePlan(profile({ experience: 'beginner', trainingDays: [0, 1, 2, 3, 4, 5], cardioLevel: 'none' }))
    expect(plan.days.filter((d) => d.exercises.length > 0)).toHaveLength(4)
  })

  it('only uses equipment you have', () => {
    const p = profile({ location: 'home', equipment: ['chair'], trainingDays: [0, 2, 4] })
    const have = availableEquipment(p)
    for (const day of generatePlan(p).days) {
      for (const pe of day.exercises) {
        const exercise = exercises.find((e) => e.id === pe.exerciseId)!
        expect(exercise.equipment.every((q) => have.has(q)), exercise.id).toBe(true)
      }
    }
  })

  it('fits the number of exercises to the time', () => {
    const short = generatePlan(profile({ sessionMinutes: 30 }))
    const long = generatePlan(profile({ sessionMinutes: 75, experience: 'intermediate' }))
    expect(short.days[0].exercises.length).toBe(4)
    expect(long.days[0].exercises.length).toBe(7)
  })

  it('plans more cardio for losing fat than for bulking', () => {
    const lose = generatePlan(profile({ goal: 'lose' }))
    const bulk = generatePlan(profile({ goal: 'bulk' }))
    expect(lose.cardioPerWeek).toBeGreaterThan(bulk.cardioPerWeek)
    expect(generatePlan(profile({ cardioLevel: 'none' })).cardioPerWeek).toBe(0)
  })

  it('keeps at least one full rest day', () => {
    const plan = generatePlan(profile({ goal: 'lose', cardioLevel: 'high', trainingDays: [0, 1, 3, 4] }))
    expect(plan.days.length).toBeLessThan(7)
  })

  it('uses only gym equipment in the gym and starts every day with a compound exercise', () => {
    for (const experience of ['beginner', 'intermediate', 'advanced'] as const) {
      for (const days of [[0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5]]) {
        for (const day of generatePlan(profile({ location: 'gym', experience, trainingDays: days })).days) {
          if (day.exercises.length === 0) continue
          const list = day.exercises.map((pe) => exercises.find((e) => e.id === pe.exerciseId)!)
          expect(list[0].compound, `${day.title} starts with ${list[0].id}`).toBe(true)
          for (const e of list) {
            expect(e.equipment.some((q) => ['bands', 'chair', 'bed', 'towel', 'backpack'].includes(q)), e.id).toBe(false)
          }
        }
      }
    }
  })

  it('plans core on at most 2 days and never to failure', () => {
    const plan = generatePlan(profile({ experience: 'advanced', trainingDays: [0, 1, 2, 3, 4, 5], sessionMinutes: 90 }))
    const coreDays = plan.days.filter((d) => d.exercises.some((pe) => exercises.find((e) => e.id === pe.exerciseId)!.pattern === 'core'))
    expect(coreDays.length).toBeLessThanOrEqual(2)
    for (const day of coreDays) {
      for (const pe of day.exercises) {
        if (exercises.find((e) => e.id === pe.exerciseId)!.pattern === 'core') expect(pe.lastSetToFailure).toBe(false)
      }
    }
  })

  it('spreads strength days evenly', () => {
    const plan = generatePlan(profile({ experience: 'beginner', trainingDays: [0, 1, 2, 3, 4, 5, 6], cardioLevel: 'none' }))
    expect(plan.days.filter((d) => d.exercises.length).map((d) => d.weekday)).toEqual([0, 2, 4, 6])
  })

  it('uses heavier rep ranges for building muscle', () => {
    const build = generatePlan(profile({ goal: 'bulk', location: 'gym' }))
    const first = build.days[0].exercises[0]
    expect(first.repsMin).toBe(6)
  })
})

describe('nextTarget', () => {
  const planned = { exerciseId: 'x', sets: 3, repsMin: 8, repsMax: 12, rir: 2, restSec: 90, lastSetToFailure: false }
  const bench = exercises.find((e) => e.id === 'bench-press')!
  const plank = exercises.find((e) => e.id === 'plank')!

  it('suggests more weight when all sets hit the top of the range', () => {
    const last = [1, 2, 3].map(() => ({ weight: 50, reps: 12 }))
    expect(nextTarget(planned, bench, last)).toContain('52,5 kg')
    expect(nextTarget(planned, bench, [1, 2, 3].map(() => ({ weight: 12, reps: 12 })))).toContain('14 kg')
  })

  it('suggests more reps otherwise', () => {
    expect(nextTarget(planned, bench, [{ weight: 50, reps: 9 }])).toContain('1 Wiederholung mehr')
  })

  it('talks about seconds for holds', () => {
    expect(nextTarget(planned, plank, [1, 2, 3].map(() => ({ weight: null, reps: 12 })))).toContain('Sek.')
  })
})

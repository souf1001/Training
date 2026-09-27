import { describe, expect, it } from 'vitest'
import { calcBmr, calcTargets, zone2 } from './nutrition'
import { DEFAULT_PROFILE } from '../state/app'

describe('calcBmr (Mifflin-St Jeor)', () => {
  it('matches the formula for men and women', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(calcBmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780)
    // 10*60 + 6.25*165 - 5*25 - 161 = 1345.25
    expect(calcBmr({ sex: 'female', weightKg: 60, heightCm: 165, age: 25 })).toBe(1345)
  })
})

describe('calcTargets', () => {
  const base = { ...DEFAULT_PROFILE, sex: 'male' as const, weightKg: 80, heightCm: 180, age: 30 }

  it('eats less to lose and more to bulk', () => {
    const lose = calcTargets({ ...base, goal: 'lose' })
    const fit = calcTargets({ ...base, goal: 'fit' })
    const bulk = calcTargets({ ...base, goal: 'bulk' })
    expect(lose.kcal).toBeLessThan(fit.kcal)
    expect(bulk.kcal).toBeGreaterThan(fit.kcal)
    expect(fit.kcal).toBeCloseTo(fit.tdee, -1)
  })

  it('macros add up to the calorie goal', () => {
    for (const dietStyle of ['balanced', 'highProtein', 'lowCarb', 'keto'] as const) {
      const t = calcTargets({ ...base, dietStyle })
      const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9
      expect(Math.abs(fromMacros - t.kcal)).toBeLessThan(25)
    }
  })

  it('keto keeps carbs at 30 g', () => {
    expect(calcTargets({ ...base, dietStyle: 'keto' }).carbs).toBe(30)
  })

  it('never goes below a safe minimum', () => {
    const tiny = calcTargets({ ...base, sex: 'female', weightKg: 45, heightCm: 150, age: 70, activity: 'sedentary', trainingDays: [], goal: 'lose' })
    expect(tiny.kcal).toBeGreaterThanOrEqual(1200)
  })

  it('uses the own calorie goal when set', () => {
    expect(calcTargets({ ...base, kcalOverride: 2222 }).kcal).toBe(2222)
  })
})

describe('zone2', () => {
  it('is 60-70 % of max heart rate', () => {
    // max = 208 - 0.7*30 = 187
    expect(zone2(30)).toEqual([112, 131])
  })
})

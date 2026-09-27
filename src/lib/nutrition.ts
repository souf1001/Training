// Calories and macros. All formulas are well-known standards:
// - BMR (Grundumsatz): Mifflin-St Jeor
// - TDEE (Gesamtverbrauch): BMR x everyday activity + training
import type { DietStyle, Goal, NutritionTargets, Profile, WeeklyLoad } from './types'

export function calcBmr(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'age'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  return Math.round(p.sex === 'male' ? base + 5 : base - 161)
}

// everyday activity without sport (job, steps, household)
const ACTIVITY_FACTOR = { sedentary: 1.2, light: 1.35, moderate: 1.5, high: 1.7 }

// Extra calories per minute of exercise, based on MET values:
// kcal/min = (MET - 1) x 3.5 x kg / 200  (minus 1 because resting is already in the BMR)
function kcalPerMinute(met: number, weightKg: number) {
  return ((met - 1) * 3.5 * weightKg) / 200
}

// `load` is what the training plan really contains (see weeklyLoad in plan.ts)
export function calcTdee(p: Profile, load: WeeklyLoad): number {
  const everyday = calcBmr(p) * ACTIVITY_FACTOR[p.activity]
  const strengthPerWeek = load.strengthSessions * p.sessionMinutes * kcalPerMinute(5, p.weightKg)
  const cardioPerWeek = load.cardioMinutes * kcalPerMinute(6, p.weightKg)
  return Math.round(everyday + (strengthPerWeek + cardioPerWeek) / 7)
}

// how much to eat compared to what you burn
export const GOAL_ADJUST: Record<Goal, number> = {
  lose: -0.2,
  recomp: -0.1,
  build: 0.08,
  bulk: 0.15,
  fit: 0,
}

// protein in gram per kg body weight
// (studies show benefits up to about 2.2 g/kg)
const PROTEIN_PER_KG: Record<Goal, number> = { lose: 2.0, recomp: 2.0, build: 1.8, bulk: 1.6, fit: 1.6 }

// share of calories from fat
const FAT_SHARE: Record<DietStyle, number> = {
  balanced: 0.28,
  highProtein: 0.27,
  lowCarb: 0.4,
  keto: 0.7,
  vegetarian: 0.28,
  vegan: 0.28,
}

export function calcTargets(p: Profile, load: WeeklyLoad): NutritionTargets {
  const bmr = calcBmr(p)
  const tdee = calcTdee(p, load)

  // a deficit bigger than 750 kcal costs too much muscle and energy
  const change = Math.max(tdee * GOAL_ADJUST[p.goal], -750)
  const minimum = p.sex === 'female' ? 1200 : 1500
  const calculated = Math.max(Math.round((tdee + change) / 10) * 10, minimum)
  const kcal = p.kcalOverride ?? calculated

  // With a lot of body fat protein is based on the weight at BMI 27,
  // otherwise the numbers get unrealistically high.
  const heightM = p.heightCm / 100
  const proteinWeight = Math.min(p.weightKg, 27 * heightM * heightM)
  const perKg = PROTEIN_PER_KG[p.goal] + (p.dietStyle === 'highProtein' ? 0.2 : 0)
  // protein never takes more than 40 % of the calories (matters for a very low own goal)
  const protein = Math.round(Math.min(proteinWeight * perKg, (kcal * 0.4) / 4))

  // Fat: the share of the diet style, at least 0.6 g/kg for hormones,
  // but never more than the calories left after protein (and keto carbs).
  const carbsFixed = p.dietStyle === 'keto' ? 30 : 0
  const left = kcal - protein * 4 - carbsFixed * 4
  const wantedFat = p.dietStyle === 'keto' ? left / 9 : Math.max((kcal * FAT_SHARE[p.dietStyle]) / 9, p.weightKg * 0.6)
  const fat = Math.round(Math.max(0, Math.min(wantedFat, left / 9)))
  const carbs = p.dietStyle === 'keto' ? carbsFixed : Math.max(Math.round((left - fat * 9) / 4), 0)

  return { bmr, tdee, kcal, protein, carbs, fat }
}

// Which diet style fits which goal, and why.
export const DIET_STYLES: Record<DietStyle, { label: string; text: string }> = {
  balanced: {
    label: 'Ausgewogen',
    text: 'Von allem etwas. Viel Energie fürs Training und am einfachsten durchzuhalten.',
  },
  highProtein: {
    label: 'High Protein',
    text: 'Mehr Eiweiß. Macht lange satt und schützt deine Muskeln, gerade im Defizit.',
  },
  lowCarb: {
    label: 'Low Carb',
    text: 'Weniger Kohlenhydrate, mehr Fett. Für manche leichter beim Abnehmen, bringt aber weniger Power im Training.',
  },
  keto: {
    label: 'Keto',
    text: 'Fast keine Kohlenhydrate (max. 30 g). Sehr streng. Nur, wenn du das wirklich willst.',
  },
  vegetarian: {
    label: 'Vegetarisch',
    text: 'Ohne Fleisch und Fisch. Eiweiß aus Milchprodukten, Eiern und Hülsenfrüchten.',
  },
  vegan: {
    label: 'Vegan',
    text: 'Rein pflanzlich. Eiweiß aus Tofu, Soja, Linsen und Seitan. Denk an Vitamin B12.',
  },
}

export function recommendedDiet(goal: Goal): DietStyle {
  return goal === 'lose' || goal === 'recomp' ? 'highProtein' : 'balanced'
}

export function sumMacros<T extends { kcal: number; protein: number; carbs: number; fat: number }>(items: T[]) {
  return items.reduce(
    (sum, i) => ({
      kcal: sum.kcal + i.kcal,
      protein: sum.protein + i.protein,
      carbs: sum.carbs + i.carbs,
      fat: sum.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

// Heart rate for easy "Zone 2" cardio. Max heart rate after Tanaka: 208 - 0.7 x age.
export function zone2(age: number): [number, number] {
  const max = 208 - 0.7 * age
  return [Math.round(max * 0.6), Math.round(max * 0.7)]
}

export function bmi(p: Pick<Profile, 'weightKg' | 'heightCm'>): number {
  const h = p.heightCm / 100
  return Math.round((p.weightKg / (h * h)) * 10) / 10
}

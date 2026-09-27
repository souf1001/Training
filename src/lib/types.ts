// Shared data types for the whole app.

export type Sex = 'male' | 'female'

// daily activity outside of training (job, steps, ...)
export type Activity = 'sedentary' | 'light' | 'moderate' | 'high'

export type Goal =
  | 'lose' // nur abnehmen
  | 'recomp' // abnehmen und Muskeln aufbauen
  | 'build' // sauber aufbauen (lean bulk)
  | 'bulk' // aufbauen / bulken
  | 'fit' // fit & gesund bleiben

export type Experience = 'beginner' | 'intermediate' | 'advanced'

export type Location = 'gym' | 'home'

// Things someone might have at home. The gym has everything.
export type Equipment =
  | 'dumbbells'
  | 'kettlebell'
  | 'bands'
  | 'pullupbar'
  | 'bench'
  | 'chair'
  | 'bed'
  | 'backpack'
  | 'towel'
  | 'barbell'
  | 'cable'
  | 'machine'

export type CardioLevel = 'none' | 'low' | 'medium' | 'high'

export type CardioType = 'walk' | 'run' | 'bike' | 'row' | 'rope' | 'stairs' | 'swim' | 'hiit'

export type DietStyle = 'balanced' | 'highProtein' | 'lowCarb' | 'keto' | 'vegetarian' | 'vegan'

export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activity: Activity
  goal: Goal
  experience: Experience
  // 0 = Monday ... 6 = Sunday
  trainingDays: number[]
  sessionMinutes: number
  location: Location
  equipment: Equipment[]
  cardioLevel: CardioLevel
  cardioTypes: CardioType[]
  dietStyle: DietStyle
  // null = use the calculated value
  kcalOverride: number | null
}

export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface NutritionTargets extends Macros {
  bmr: number
  tdee: number
}

// Movement patterns are the "slots" a training day is built from.
export type Pattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'pushH' // horizontal push (bench press, push-up)
  | 'pushV' // vertical push (overhead press)
  | 'pullH' // horizontal pull (rows)
  | 'pullV' // vertical pull (pull-up, lat pulldown)
  | 'glutes'
  | 'core'
  | 'biceps'
  | 'triceps'
  | 'shoulders' // lateral / rear delts
  | 'calves'

export interface Exercise {
  id: string
  name: string
  pattern: Pattern
  primary: string[] // main muscles (German)
  secondary: string[]
  // every item is required, [] = only bodyweight / floor / wall
  equipment: Equipment[]
  level: Experience
  compound: boolean
  // true = measured in seconds instead of reps (e.g. plank)
  timed?: boolean
  // folder name in /public/exercises (two frames: 0.jpg and 1.jpg)
  image: string
  steps: string[]
  feel: string[] // where you should feel it
  notFeel: string[] // what you should NOT feel and how to fix it
  tips: string[]
  mistakes: string[]
}

export interface PlannedExercise {
  exerciseId: string
  sets: number
  repsMin: number
  repsMax: number
  // reps in reserve: how many reps you could still do at the end of a set
  rir: number
  restSec: number
  // last set to failure?
  lastSetToFailure: boolean
}

export interface CardioSession {
  type: CardioType
  minutes: number
  intensity: 'easy' | 'moderate' | 'intervals'
  note: string
}

export interface PlanDay {
  weekday: number // 0 = Monday
  title: string
  focus: string
  exercises: PlannedExercise[]
  cardio: CardioSession | null
}

export interface Plan {
  createdAt: string
  splitName: string
  days: PlanDay[]
  cardioPerWeek: number
  stepsGoal: number
  notes: string[]
}

export interface LoggedSet {
  weight: number | null
  reps: number | null
  done: boolean
}

export interface LoggedExercise {
  exerciseId: string
  sets: LoggedSet[]
}

export interface Workout {
  id?: number
  date: string // ISO
  title: string
  durationMin: number
  exercises: LoggedExercise[]
  cardioMinutes?: number
}

export interface FoodEntry {
  id?: number
  eatenAt: string // ISO
  name: string
  amount: string // "200 g", "1 Stück"
  kcal: number
  protein: number
  carbs: number
  fat: number
  source: 'ai' | 'db' | 'manual' | 'off'
}

export interface WeightEntry {
  id?: number
  date: string // YYYY-MM-DD
  kg: number
}

export interface AiSettings {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
}

// An item of the built-in food table (values per 100 g or 100 ml).
export interface Food {
  name: string
  aliases: string[] // other words people use, lowercase
  kcal: number
  protein: number
  carbs: number
  fat: number
  // a typical piece/portion, e.g. { name: 'Stück', grams: 120 } for a banana
  unit: { name: string; grams: number } | null
  // used when someone only types "Reis" without an amount
  defaultGrams: number
}

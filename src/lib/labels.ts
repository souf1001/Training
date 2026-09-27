// German texts for all choices in the app.
import type { Activity, CardioLevel, CardioType, Equipment, Experience, Goal, Sex } from './types'

export const SEX: Record<Sex, string> = { male: 'Mann', female: 'Frau' }

export const GOALS: Record<Goal, { label: string; text: string }> = {
  lose: { label: 'Abnehmen', text: 'Fett verlieren, leichter werden' },
  recomp: { label: 'Abnehmen & Muskeln aufbauen', text: 'Straffer werden: Fett runter, Muskeln rauf' },
  build: { label: 'Muskeln aufbauen', text: 'Sauber aufbauen mit kleinem Überschuss' },
  bulk: { label: 'Bulken', text: 'Maximal Masse und Kraft aufbauen' },
  fit: { label: 'Fit & gesund bleiben', text: 'Gewicht halten, fitter werden' },
}

export const ACTIVITY: Record<Activity, { label: string; text: string }> = {
  sedentary: { label: 'Wenig aktiv', text: 'Bürojob, kaum Bewegung im Alltag' },
  light: { label: 'Leicht aktiv', text: 'Viel im Sitzen, aber regelmäßig zu Fuß unterwegs' },
  moderate: { label: 'Aktiv', text: 'Viel auf den Beinen, z. B. Verkauf, Pflege' },
  high: { label: 'Sehr aktiv', text: 'Körperliche Arbeit, z. B. Bau, Handwerk' },
}

export const EXPERIENCE: Record<Experience, { label: string; text: string }> = {
  beginner: { label: 'Anfänger', text: 'Neu dabei oder länger als 6 Monate Pause' },
  intermediate: { label: 'Fortgeschritten', text: '6 Monate bis 2 Jahre regelmäßiges Training' },
  advanced: { label: 'Erfahren', text: 'Mehr als 2 Jahre, saubere Technik bei den Grundübungen' },
}

// equipment you can pick for training at home
export const HOME_EQUIPMENT: { id: Equipment; label: string; text: string }[] = [
  { id: 'dumbbells', label: 'Kurzhanteln', text: 'Ein Paar, am besten verstellbar' },
  { id: 'kettlebell', label: 'Kettlebell', text: '' },
  { id: 'bands', label: 'Widerstandsbänder', text: 'Fitnessbänder oder Tubes' },
  { id: 'pullupbar', label: 'Klimmzugstange', text: 'z. B. im Türrahmen' },
  { id: 'bench', label: 'Hantelbank', text: '' },
  { id: 'chair', label: 'Stabiler Stuhl', text: 'Ohne Rollen' },
  { id: 'bed', label: 'Bett- oder Sofakante', text: '' },
  { id: 'backpack', label: 'Rucksack', text: 'Mit Büchern oder Wasserflaschen als Gewicht' },
  { id: 'towel', label: 'Handtuch', text: 'Zum Rutschen oder Ziehen' },
]

export const ALL_EQUIPMENT: Equipment[] = [
  'dumbbells',
  'kettlebell',
  'bands',
  'pullupbar',
  'bench',
  'chair',
  'bed',
  'backpack',
  'towel',
  'barbell',
  'cable',
  'machine',
]

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  dumbbells: 'Kurzhanteln',
  kettlebell: 'Kettlebell',
  bands: 'Bänder',
  pullupbar: 'Klimmzugstange',
  bench: 'Bank',
  chair: 'Stuhl',
  bed: 'Bettkante',
  backpack: 'Rucksack',
  towel: 'Handtuch',
  barbell: 'Langhantel',
  cable: 'Kabelzug',
  machine: 'Maschine',
}

export const CARDIO_LEVEL: Record<CardioLevel, { label: string; text: string }> = {
  none: { label: 'Kein Cardio', text: 'Nur Krafttraining und Schritte im Alltag' },
  low: { label: 'Ein bisschen', text: '1–2 kurze Einheiten pro Woche' },
  medium: { label: 'Normal', text: 'So viel, wie für dein Ziel sinnvoll ist' },
  high: { label: 'Gerne viel', text: 'Ich mag Ausdauer, plane ruhig mehr ein' },
}

export const CARDIO_TYPES: Record<CardioType, string> = {
  walk: 'Zügig gehen',
  run: 'Laufen',
  bike: 'Radfahren / Ergometer',
  row: 'Rudern',
  rope: 'Seilspringen',
  stairs: 'Treppen / Stepper',
  swim: 'Schwimmen',
  hiit: 'HIIT ohne Geräte',
}

export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

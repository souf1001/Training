// Formatting and parsing of numbers and training prescriptions.
import type { Exercise, PlannedExercise } from './types'

// German number format: 1.960 and 72,5
export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits })
}

export function formatKg(kg: number): string {
  return `${formatNumber(kg, 1)} kg`
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// "72,5" or "72.5" -> 72.5; empty or invalid -> null
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  const n = Number(trimmed)
  return trimmed === '' || !Number.isFinite(n) ? null : n
}

// "1 Minute" / "3 Minuten"
export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n, 1)} ${n === 1 ? one : many}`
}

export function formatSetsReps(p: PlannedExercise, e: Exercise): string {
  const unit = e.timed ? ' Sek.' : ''
  return `${p.sets} × ${p.repsMin}–${p.repsMax}${unit}`
}

export function formatEffort(p: PlannedExercise, e?: Exercise): string {
  if (e?.timed) return 'sauber halten, bis kurz vor dem Zittern'
  if (p.rir === 0) return 'bis zum Muskelversagen'
  const base = `${p.rir} Wdh. in Reserve`
  return p.lastSetToFailure ? `${base}, letzter Satz bis zum Versagen` : base
}

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

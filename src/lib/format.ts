// Formatting for training prescriptions.
import type { Exercise, PlannedExercise } from './types'

export function formatSetsReps(p: PlannedExercise, e: Exercise): string {
  const unit = e.timed ? ' Sek.' : ''
  return `${p.sets} × ${p.repsMin}–${p.repsMax}${unit}`
}

export function formatEffort(p: PlannedExercise): string {
  if (p.rir === 0) return 'bis zum Muskelversagen'
  const base = `${p.rir} Wdh. in Reserve`
  return p.lastSetToFailure ? `${base}, letzter Satz bis zum Versagen` : base
}

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

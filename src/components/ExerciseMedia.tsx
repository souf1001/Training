// Shows an exercise as a small animation: start and end position fade into each other.
// Photos: free-exercise-db (public domain).
import type { Exercise } from '../lib/types'

export function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  const base = `/exercises/${exercise.image}`
  return (
    <div className="exercise-media">
      <img src={`${base}/0.jpg`} alt={`${exercise.name}: Startposition`} />
      <img src={`${base}/1.jpg`} alt={`${exercise.name}: Endposition`} className="frame-2" />
    </div>
  )
}

export function ExerciseThumb({ exercise }: { exercise: Exercise }) {
  return (
    <div className="thumb">
      <img src={`/exercises/${exercise.image}/0.jpg`} alt="" loading="lazy" />
    </div>
  )
}

// Live workout: log weight and reps per set, rest timer, progression hints.
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronRight, HeartPulse, Plus, Trophy } from 'lucide-react'
import { BackBar, Spinner, Tip, formatNumber } from '../components/ui'
import { ExerciseThumb } from '../components/ExerciseMedia'
import { useMe } from '../state/app'
import { useWorkouts } from '../lib/hooks'
import { api } from '../lib/api'
import { dayKey } from '../lib/dates'
import { exerciseById, nextTarget } from '../lib/plan'
import { formatEffort, formatRest, formatSetsReps } from '../lib/format'
import { tipFor } from '../lib/tips'
import type { LoggedExercise, LoggedSet, PlanDay, Workout } from '../lib/types'

interface Session {
  startedAt: string
  exercises: LoggedExercise[]
  cardioDone: boolean
  cardioMinutes: number
}

function newSession(day: PlanDay, history: Workout[]): Session {
  return {
    startedAt: new Date().toISOString(),
    exercises: day.exercises.map((pe) => {
      // start with last time's weight, so you only have to confirm it
      const last = lastSets(history, pe.exerciseId)
      const weight = last?.find((s) => s.weight != null)?.weight ?? null
      return {
        exerciseId: pe.exerciseId,
        sets: Array.from({ length: pe.sets }, () => ({ weight, reps: null, done: false })),
      }
    }),
    cardioDone: false,
    cardioMinutes: day.cardio?.minutes ?? 0,
  }
}

function lastSets(history: Workout[], exerciseId: string): LoggedSet[] | undefined {
  for (const workout of history) {
    const found = workout.exercises.find((e) => e.exerciseId === exerciseId)
    if (found) return found.sets
  }
  return undefined
}

export function WorkoutPage() {
  const { weekday } = useParams()
  const { me } = useMe()
  const history = useWorkouts(50)
  const day = me.plan.days.find((d) => d.weekday === Number(weekday))
  if (!day) return <Navigate to="/plan" replace />
  if (history.loading) {
    return (
      <div className="center-screen">
        <Spinner />
      </div>
    )
  }
  return <Workout day={day} history={history.data} />
}

function Workout({ day, history }: { day: PlanDay; history: Workout[] }) {
  const { me } = useMe()
  const navigate = useNavigate()
  const storageKey = `forma.workout.${dayKey()}.${day.weekday}`
  const [session, setSession] = useState<Session>(() => {
    const saved = localStorage.getItem(storageKey)
    const session = saved ? (JSON.parse(saved) as Session) : null
    // only continue a saved session if the exercises are still the same (no swap in between)
    const sameExercises = session?.exercises.map((e) => e.exerciseId).join() === day.exercises.map((e) => e.exerciseId).join()
    return session && sameExercises ? session : newSession(day, history)
  })
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [finished, setFinished] = useState<Workout | null>(null)
  const [error, setError] = useState('')

  // keep the session if the app is closed in between
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(session))
  }, [session, storageKey])

  function updateSet(exerciseIndex: number, setIndex: number, changes: Partial<LoggedSet>) {
    setSession((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) =>
        i === exerciseIndex ? { ...e, sets: e.sets.map((set, j) => (j === setIndex ? { ...set, ...changes } : set)) } : e,
      ),
    }))
  }

  function toggleDone(exerciseIndex: number, setIndex: number) {
    const set = session.exercises[exerciseIndex].sets[setIndex]
    const planned = day.exercises[exerciseIndex]
    const done = !set.done
    // no reps typed? assume the lower end of the target range
    updateSet(exerciseIndex, setIndex, { done, reps: set.reps ?? (done ? planned.repsMin : null) })
    if (done) setRestUntil(Date.now() + planned.restSec * 1000)
  }

  function addSet(exerciseIndex: number) {
    setSession((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => {
        if (i !== exerciseIndex) return e
        const last = e.sets[e.sets.length - 1]
        return { ...e, sets: [...e.sets, { weight: last?.weight ?? null, reps: null, done: false }] }
      }),
    }))
  }

  async function finish() {
    setSaving(true)
    setError('')
    const minutes = Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000))
    const workout: Workout = {
      date: new Date().toISOString(),
      title: day.title,
      durationMin: minutes,
      exercises: session.exercises
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
        .filter((e) => e.sets.length > 0),
      cardioMinutes: session.cardioDone ? session.cardioMinutes : 0,
    }
    try {
      await api.post('/workouts', workout)
      localStorage.removeItem(storageKey)
      setFinished(workout)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (finished) return <Summary workout={finished} onDone={() => navigate('/heute')} />

  const doneSets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)

  return (
    <div className="page no-tabs" style={{ paddingBottom: 120 }}>
      <BackBar
        to={`/plan/${day.weekday}`}
        action={
          <button className="btn small" onClick={finish} disabled={saving || (doneSets === 0 && !session.cardioDone)}>
            {saving ? <Spinner /> : 'Fertig'}
          </button>
        }
      />
      <h1 className="title">{day.title}</h1>
      {error && <p className="error">{error}</p>}

      {day.exercises.map((planned, i) => {
        const exercise = exerciseById(planned.exerciseId)
        const logged = session.exercises[i]
        if (!exercise || !logged) return null
        const hint = nextTarget(planned, lastSets(history, planned.exerciseId))
        return (
          <div key={i} className="card stack">
            <Link to={`/uebung/${exercise.id}`} className="row" style={{ color: 'inherit' }}>
              <ExerciseThumb exercise={exercise} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650 }}>{exercise.name}</div>
                <div className="muted small num">
                  {formatSetsReps(planned, exercise)} · {formatRest(planned.restSec)} Pause
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-3)" />
            </Link>
            <div className="small" style={{ color: 'var(--text-2)' }}>
              {formatEffort(planned)}. {hint}
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <div className="set-row head">
                <span>#</span>
                <span>kg</span>
                <span>{exercise.timed ? 'Sek.' : 'Wdh.'}</span>
                <span />
              </div>
              {logged.sets.map((set, j) => (
                <div key={j} className={`set-row ${set.done ? 'done' : ''}`}>
                  <span className="muted num" style={{ textAlign: 'center', fontWeight: 600 }}>
                    {j + 1}
                  </span>
                  <input
                    className="input num"
                    inputMode="decimal"
                    placeholder="–"
                    value={set.weight ?? ''}
                    onChange={(e) => updateSet(i, j, { weight: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) })}
                    aria-label={`Satz ${j + 1} Gewicht`}
                  />
                  <input
                    className="input num"
                    inputMode="numeric"
                    placeholder={`${planned.repsMin}–${planned.repsMax}`}
                    value={set.reps ?? ''}
                    onChange={(e) => updateSet(i, j, { reps: e.target.value === '' ? null : Number(e.target.value) })}
                    aria-label={`Satz ${j + 1} Wiederholungen`}
                  />
                  <button className={`set-check ${set.done ? 'done' : ''}`} onClick={() => toggleDone(i, j)} aria-label={`Satz ${j + 1} erledigt`}>
                    <Check size={20} strokeWidth={3} />
                  </button>
                </div>
              ))}
              <button className="btn ghost small" onClick={() => addSet(i)} style={{ alignSelf: 'flex-start' }}>
                <Plus size={16} /> Satz
              </button>
            </div>
          </div>
        )
      })}

      {day.cardio && (
        <div className="card stack">
          <div className="row card-label" style={{ gap: 6 }}>
            <HeartPulse size={14} /> Cardio
          </div>
          <p className="muted small">{day.cardio.note}</p>
          <div className="row">
            <input
              className="input num"
              style={{ width: 90 }}
              inputMode="numeric"
              value={session.cardioMinutes}
              onChange={(e) => setSession({ ...session, cardioMinutes: Number(e.target.value) || 0 })}
              aria-label="Cardio Minuten"
            />
            <span className="muted grow">Minuten</span>
            <button className={`set-check ${session.cardioDone ? 'done' : ''}`} onClick={() => setSession({ ...session, cardioDone: !session.cardioDone })} aria-label="Cardio erledigt">
              <Check size={20} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      <Tip>{tipFor(me.profile.goal, 'workout')}</Tip>

      {restUntil && <RestTimer until={restUntil} onChange={setRestUntil} />}
    </div>
  )
}

function RestTimer({ until, onChange }: { until: number; onChange: (until: number | null) => void }) {
  const [now, setNow] = useState(Date.now())
  const left = Math.max(0, Math.round((until - now) / 1000))

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (left === 0) {
      beep()
      navigator.vibrate?.([200, 100, 200])
      onChange(null)
    }
  }, [left, onChange])

  return (
    <div className="rest-bar">
      <div>
        <div className="stack" style={{ gap: 0, flex: 1 }}>
          <span className="tiny" style={{ opacity: 0.7 }}>
            Pause
          </span>
          <span className="time">{formatRest(left)}</span>
        </div>
        <button onClick={() => onChange(until - 15000)}>−15</button>
        <button onClick={() => onChange(until + 15000)}>+15</button>
        <button onClick={() => onChange(null)}>Weiter</button>
      </div>
    </div>
  )
}

// short "ding" when the rest is over
function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // no audio available, that's fine
  }
}

function Summary({ workout, onDone }: { workout: Workout; onDone: () => void }) {
  const sets = workout.exercises.reduce((n, e) => n + e.sets.length, 0)
  const volume = workout.exercises.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0), 0)
  return (
    <div className="page no-tabs" style={{ minHeight: '100dvh', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="logo-mark" style={{ width: 72, height: 72, borderRadius: 24 }}>
          <Trophy size={36} />
        </div>
      </div>
      <h1 className="title">Stark gemacht!</h1>
      <p className="muted">{workout.title} ist gespeichert.</p>
      <div className="grid-3">
        <div className="card stat">
          <span className="value">{workout.durationMin}</span>
          <span className="label">Minuten</span>
        </div>
        <div className="card stat">
          <span className="value">{sets}</span>
          <span className="label">Sätze</span>
        </div>
        <div className="card stat">
          <span className="value">{formatNumber(volume)}</span>
          <span className="label">kg bewegt</span>
        </div>
      </div>
      <Tip>Jetzt ist eine gute Zeit für eine Mahlzeit mit Eiweiß und Kohlenhydraten.</Tip>
      <button className="btn block" onClick={onDone}>
        Fertig
      </button>
    </div>
  )
}

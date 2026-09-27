// Live workout: log weight and reps per set, rest timer, progression hints.
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronRight, HeartPulse, Plus, Trophy } from 'lucide-react'
import { BackBar, ErrorText, Spinner, Tip } from '../components/ui'
import { DecimalInput } from '../components/fields'
import { ExerciseThumb } from '../components/ExerciseMedia'
import { queueWorkout, useMe } from '../state/app'
import { useWorkouts } from '../lib/hooks'
import { api, ApiError } from '../lib/api'
import { dayKey } from '../lib/dates'
import { exerciseById, nextTarget } from '../lib/plan'
import { formatEffort, formatNumber, formatRest, formatSetsReps, plural } from '../lib/format'
import { readJson, removeKeys, writeJson } from '../lib/storage'
import { tipFor } from '../lib/tips'
import type { Exercise, LoggedExercise, LoggedSet, PlanDay, Workout } from '../lib/types'

interface Session {
  startedAt: string
  exercises: LoggedExercise[]
  cardioDone: boolean
  cardioMinutes: number
  restUntil: number | null
}

// exercises without extra weight: no kg column
const noWeight = (e: Exercise) => Boolean(e.timed) || e.equipment.every((q) => ['chair', 'bed', 'towel'].includes(q))

function lastSets(history: Workout[], exerciseId: string): LoggedSet[] | undefined {
  for (const workout of history) {
    const found = workout.exercises.find((e) => e?.exerciseId === exerciseId)
    if (found) return found.sets
  }
  return undefined
}

function newSession(day: PlanDay, history: Workout[]): Session {
  return {
    startedAt: new Date().toISOString(),
    exercises: day.exercises.map((pe) => {
      // start with what you did last time, so you only have to confirm it
      const last = lastSets(history, pe.exerciseId) ?? []
      const lastWeight = last.find((s) => s.weight != null)?.weight ?? null
      return {
        exerciseId: pe.exerciseId,
        sets: Array.from({ length: pe.sets }, (_, j) => ({ weight: last[j]?.weight ?? lastWeight, reps: null, done: false })),
      }
    }),
    cardioDone: false,
    cardioMinutes: day.cardio?.minutes ?? 0,
    restUntil: null,
  }
}

export function WorkoutPage() {
  const { weekday } = useParams()
  const { me } = useMe()
  const history = useWorkouts(30)
  const day = me.plan.days.find((d) => d.weekday === Number(weekday))
  if (!day) return <Navigate to="/plan" replace />
  if (history.loading) {
    return (
      <div className="center-screen">
        <Spinner />
      </div>
    )
  }
  return <WorkoutSession day={day} history={history.data} />
}

function WorkoutSession({ day, history }: { day: PlanDay; history: Workout[] }) {
  const { me } = useMe()
  const navigate = useNavigate()
  // fixed when the workout starts, so it doesn't change at midnight
  const [storageKey] = useState(() => `forma.workout.${dayKey()}.${day.weekday}`)
  const [session, setSession] = useState<Session>(() => {
    const saved = readJson<Session>(storageKey)
    // only continue a saved session if the exercises are still the same (no swap in between)
    const sameExercises = saved?.exercises?.map((e) => e.exerciseId).join() === day.exercises.map((e) => e.exerciseId).join()
    return saved && sameExercises ? saved : newSession(day, history)
  })
  const [saving, setSaving] = useState(false)
  const [finished, setFinished] = useState<{ workout: Workout; offline: boolean } | null>(null)
  const [error, setError] = useState('')
  const audio = useRef<AudioContext | null>(null)

  // keep the session if the app is closed in between; forget old unfinished sessions
  useEffect(() => {
    writeJson(storageKey, session)
  }, [session, storageKey])
  useEffect(() => {
    removeKeys((key) => key.startsWith('forma.workout.') && key !== storageKey)
  }, [storageKey])

  // keep the screen on while training (where the browser supports it)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const wakeLock = (navigator as unknown as { wakeLock?: { request: (type: 'screen') => Promise<typeof lock> } }).wakeLock
    wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => {
      lock?.release().catch(() => {})
    }
  }, [])

  const setRestUntil = (restUntil: number | null) => setSession((s) => ({ ...s, restUntil }))

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
    // no reps typed: take the number from last time (shown as placeholder), else the target
    const lastReps = lastSets(history, planned.exerciseId)?.[setIndex]?.reps
    const reps = set.reps ?? (done ? (lastReps ?? planned.repsMax) : null)

    setSession((s) => ({
      ...s,
      restUntil: done ? Date.now() + planned.restSec * 1000 : s.restUntil,
      exercises: s.exercises.map((e, i) => {
        if (i !== exerciseIndex) return e
        return {
          ...e,
          sets: e.sets.map((other, j) => {
            if (j === setIndex) return { ...other, done, reps }
            // carry the weight over to the following sets that have none yet
            if (done && j > setIndex && other.weight == null) return { ...other, weight: set.weight }
            return other
          }),
        }
      }),
    }))

    // the sound for the rest timer must be unlocked by a tap (iOS)
    if (done && !audio.current && typeof AudioContext !== 'undefined') audio.current = new AudioContext()
    audio.current?.resume().catch(() => {})
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

  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  const doneSets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)

  async function finish() {
    if (doneSets < totalSets && !confirm(`${doneSets} von ${totalSets} Sätzen erledigt. Training trotzdem beenden?`)) return
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
      writeJson(storageKey, null)
      setFinished({ workout, offline: false })
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        // no internet in the gym: save it on the phone and send it later
        queueWorkout(workout)
        writeJson(storageKey, null)
        setFinished({ workout, offline: true })
      } else {
        setError((err as Error).message)
      }
    } finally {
      setSaving(false)
    }
  }

  if (finished) return <Summary workout={finished.workout} offline={finished.offline} onDone={() => navigate('/heute')} />

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
      <div className="stack tight">
        <h1 className="title">{day.title}</h1>
        <p className="muted num">
          {doneSets} von {plural(totalSets, 'Satz', 'Sätzen')} erledigt
        </p>
      </div>
      <ErrorText>{error}</ErrorText>

      {day.exercises.map((planned, i) => {
        const exercise = exerciseById(planned.exerciseId)
        const logged = session.exercises[i]
        if (!exercise || !logged) return null
        const last = lastSets(history, planned.exerciseId)
        const withWeight = !noWeight(exercise)
        const unit = exercise.timed ? 'Sek.' : 'Wdh.'
        const columns = withWeight ? undefined : { gridTemplateColumns: '28px 1fr 44px' }
        return (
          <div key={i} className="card stack">
            <Link to={`/uebung/${exercise.id}`} className="row" style={{ color: 'inherit' }}>
              <ExerciseThumb exercise={exercise} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="strong">{exercise.name}</div>
                <div className="muted small num">
                  {formatSetsReps(planned, exercise)} · {formatRest(planned.restSec)} Pause
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-3)" />
            </Link>
            <div className="small muted">
              {formatEffort(planned, exercise)}. {nextTarget(planned, exercise, last)}
            </div>
            {last && last.length > 0 && (
              <div className="small num">
                <span className="muted">Letztes Mal: </span>
                {last.map((s) => (s.weight ? `${formatNumber(s.weight, 2)} kg × ${s.reps}` : `${s.reps} ${unit}`)).join(', ')}
              </div>
            )}

            <div className="stack tight">
              <div className="set-row head" style={columns}>
                <span>#</span>
                {withWeight && <span>kg</span>}
                <span>{unit}</span>
                <span />
              </div>
              {logged.sets.map((set, j) => (
                <div key={j} className={`set-row ${set.done ? 'done' : ''}`} style={columns}>
                  <span className="muted num strong" style={{ textAlign: 'center' }}>
                    {j + 1}
                  </span>
                  {withWeight && (
                    <DecimalInput
                      className="input num"
                      placeholder="–"
                      value={set.weight}
                      onChange={(weight) => updateSet(i, j, { weight })}
                      aria-label={`${exercise.name}, Satz ${j + 1}, Gewicht in kg`}
                    />
                  )}
                  <DecimalInput
                    className="input num"
                    inputMode="numeric"
                    placeholder={String(last?.[j]?.reps ?? `${planned.repsMin}–${planned.repsMax}`)}
                    value={set.reps}
                    onChange={(reps) => updateSet(i, j, { reps: reps == null ? null : Math.round(reps) })}
                    aria-label={`${exercise.name}, Satz ${j + 1}, ${exercise.timed ? 'Sekunden' : 'Wiederholungen'}`}
                  />
                  <button
                    className={`set-check ${set.done ? 'done' : ''}`}
                    onClick={() => toggleDone(i, j)}
                    aria-label={`${exercise.name}, Satz ${j + 1} erledigt`}
                    aria-pressed={set.done}
                  >
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
          <div className="row tight card-label">
            <HeartPulse size={14} /> Cardio
          </div>
          <p className="muted small">{day.cardio.note}</p>
          <div className="row">
            <DecimalInput
              className="input num"
              style={{ width: 90 }}
              inputMode="numeric"
              value={session.cardioMinutes}
              onChange={(minutes) => setSession((s) => ({ ...s, cardioMinutes: Math.round(minutes ?? 0) }))}
              aria-label="Cardio Minuten"
            />
            <span className="muted grow">Minuten</span>
            <button
              className={`set-check ${session.cardioDone ? 'done' : ''}`}
              onClick={() => setSession((s) => ({ ...s, cardioDone: !s.cardioDone }))}
              aria-label="Cardio erledigt"
              aria-pressed={session.cardioDone}
            >
              <Check size={20} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      <Tip>{tipFor(me.profile.goal, 'workout')}</Tip>

      {session.restUntil && <RestTimer until={session.restUntil} onChange={setRestUntil} onDone={() => beep(audio.current)} />}
    </div>
  )
}

function RestTimer({ until, onChange, onDone }: { until: number; onChange: (until: number | null) => void; onDone: () => void }) {
  const [now, setNow] = useState(Date.now())
  const left = Math.max(0, Math.round((until - now) / 1000))

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (left > 0) return
    // only ring when the rest ended just now, not when an old timer is restored after hours
    if (Date.now() - until < 5000) {
      onDone()
      navigator.vibrate?.([200, 100, 200])
    }
    onChange(null)
  }, [left, until, onChange, onDone])

  return (
    <div className="rest-bar" role="timer">
      <div>
        <div className="stack" style={{ gap: 0, flex: 1 }}>
          <span className="tiny" style={{ opacity: 0.7 }}>
            Pause
          </span>
          <span className="time">{formatRest(left)}</span>
        </div>
        <button onClick={() => onChange(until - 15000)} aria-label="15 Sekunden weniger">
          −15
        </button>
        <button onClick={() => onChange(until + 15000)} aria-label="15 Sekunden mehr">
          +15
        </button>
        <button onClick={() => onChange(null)}>Überspringen</button>
      </div>
    </div>
  )
}

// short "ding" when the rest is over
function beep(ctx: AudioContext | null) {
  if (!ctx) return
  try {
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

function Summary({ workout, offline, onDone }: { workout: Workout; offline: boolean; onDone: () => void }) {
  const sets = workout.exercises.reduce((n, e) => n + e.sets.length, 0)
  const reps = workout.exercises.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + (set.reps ?? 0), 0), 0)
  const volume = workout.exercises.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0), 0)
  return (
    <div className="page no-tabs" style={{ minHeight: '100dvh', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="logo-mark" style={{ width: 72, height: 72, borderRadius: 24 }}>
          <Trophy size={36} />
        </div>
      </div>
      <h1 className="title">Stark gemacht!</h1>
      <p className="muted">
        {offline ? `${workout.title} ist auf deinem Handy gespeichert und wird hochgeladen, sobald du online bist.` : `${workout.title} ist gespeichert.`}
      </p>
      <div className="grid-3">
        <div className="card stat">
          <span className="value">{workout.durationMin}</span>
          <span className="label">{workout.durationMin === 1 ? 'Minute' : 'Minuten'}</span>
        </div>
        <div className="card stat">
          <span className="value">{sets}</span>
          <span className="label">{sets === 1 ? 'Satz' : 'Sätze'}</span>
        </div>
        <div className="card stat">
          <span className="value">{formatNumber(volume > 0 ? volume : reps)}</span>
          <span className="label">{volume > 0 ? 'kg bewegt' : 'Wiederholungen'}</span>
        </div>
      </div>
      <Tip>Jetzt ist eine gute Zeit für eine Mahlzeit mit Eiweiß und Kohlenhydraten.</Tip>
      <button className="btn block" onClick={onDone}>
        Fertig
      </button>
    </div>
  )
}

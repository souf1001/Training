import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { PageHeader, Sheet, formatNumber } from '../components/ui'
import { BarChart, LineChart } from '../components/charts'
import { useMe } from '../state/app'
import { useFood, useWeights, useWorkouts } from '../lib/hooks'
import { api } from '../lib/api'
import { addDays, dayKey, formatDate, startOfDay, weekdayIndex } from '../lib/dates'
import { exerciseById, formatKg } from '../lib/plan'
import { WEEKDAYS_SHORT } from '../lib/labels'
import type { Workout } from '../lib/types'

export function ProgressPage() {
  const { me, targets, saveProfile } = useMe()
  const weights = useWeights()
  const workouts = useWorkouts()
  const today = startOfDay(new Date())
  const weekStart = addDays(today, -6)
  const food = useFood(weekStart, 7)
  const [weightInput, setWeightInput] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [openWorkout, setOpenWorkout] = useState<Workout | null>(null)

  async function saveWeight() {
    const kg = Number(weightInput.replace(',', '.'))
    if (!(kg > 20 && kg < 400)) return
    await api.post('/weights', { date: dayKey(), kg })
    // the current weight also updates the calorie targets
    await saveProfile({ ...me.profile, weightKg: kg })
    setWeightInput('')
    weights.reload()
  }

  // stats
  const monday = addDays(today, -weekdayIndex(today))
  const thisWeek = workouts.data.filter((w) => new Date(w.date) >= monday).length
  const thisMonth = workouts.data.filter((w) => new Date(w.date) >= new Date(today.getFullYear(), today.getMonth(), 1)).length

  // weight chart
  const weightPoints = weights.data.slice(-60).map((w) => ({
    label: formatDate(w.date, { day: '2-digit', month: '2-digit' }),
    value: w.kg,
  }))
  const firstWeight = weights.data[0]?.kg
  const lastWeight = weights.data[weights.data.length - 1]?.kg
  const change = firstWeight != null && lastWeight != null ? lastWeight - firstWeight : 0

  // calories of the last 7 days
  const kcalPoints = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i)
    const kcal = food.data.filter((f) => dayKey(new Date(f.eatenAt)) === dayKey(day)).reduce((sum, f) => sum + f.kcal, 0)
    return { label: WEEKDAYS_SHORT[weekdayIndex(day)], value: kcal }
  })
  const trackedDays = kcalPoints.filter((p) => p.value > 0)
  const average = trackedDays.length ? trackedDays.reduce((s, p) => s + p.value, 0) / trackedDays.length : 0

  return (
    <div className="page">
      <PageHeader title="Fortschritt" />

      <div className="grid-3">
        <div className="card stat">
          <span className="value">{thisWeek}</span>
          <span className="label">Diese Woche</span>
        </div>
        <div className="card stat">
          <span className="value">{thisMonth}</span>
          <span className="label">Diesen Monat</span>
        </div>
        <div className="card stat">
          <span className="value">{workouts.data.length}</span>
          <span className="label">Gesamt</span>
        </div>
      </div>

      {/* body weight */}
      <div className="card stack">
        <div className="spread">
          <div>
            <div className="card-label">Gewicht</div>
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span className="big-number" style={{ fontSize: 32 }}>
                {formatNumber(lastWeight ?? me.profile.weightKg, 1)}
              </span>
              <span className="muted">kg</span>
            </div>
          </div>
          {weights.data.length > 1 && (
            <span className="chip num">
              {change > 0 ? '+' : ''}
              {formatNumber(change, 1)} kg seit Start
            </span>
          )}
        </div>
        {weightPoints.length > 1 ? (
          <LineChart points={weightPoints} unit="kg" />
        ) : (
          <p className="muted small">Trag dein Gewicht regelmäßig ein, am besten morgens, dann siehst du hier deinen Verlauf.</p>
        )}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            saveWeight()
          }}
        >
          <input className="input" inputMode="decimal" placeholder="Gewicht heute (kg)" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} />
          <button className="btn" disabled={!weightInput}>
            Speichern
          </button>
        </form>
        {weights.data.length > 0 && (
          <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Weniger anzeigen' : 'Alle Einträge'}
          </button>
        )}
        {showAll && (
          <div className="card tight" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
            {[...weights.data].reverse().map((w) => (
              <div key={w.id} className="list-item" style={{ cursor: 'default', padding: '10px 14px' }}>
                <span className="grow small">{formatDate(w.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="num small">{formatNumber(w.kg, 1)} kg</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* calories */}
      <div className="card stack">
        <div className="spread">
          <div className="card-label">Kalorien, letzte 7 Tage</div>
          {trackedDays.length > 0 && <span className="muted small num">Ø {formatNumber(average)} kcal</span>}
        </div>
        <BarChart points={kcalPoints} target={targets.kcal} unit="kcal" />
      </div>

      {/* history */}
      <h2 className="section-title">Trainings</h2>
      {workouts.data.length === 0 ? (
        <p className="empty">Noch kein Training gespeichert. Dein erstes wartet im Plan.</p>
      ) : (
        <div className="card tight">
          {workouts.data.slice(0, 30).map((w) => (
            <button key={w.id} className="list-item" onClick={() => setOpenWorkout(w)}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{w.title}</div>
                <div className="muted small">
                  {formatDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {w.durationMin} Min. · {w.exercises.reduce((n, e) => n + e.sets.length, 0)} Sätze
                </div>
              </div>
              <ChevronRight size={18} className="chev" />
            </button>
          ))}
        </div>
      )}

      {openWorkout && (
        <WorkoutDetails
          workout={openWorkout}
          onClose={() => setOpenWorkout(null)}
          onDeleted={() => {
            setOpenWorkout(null)
            workouts.reload()
          }}
        />
      )}
    </div>
  )
}

function WorkoutDetails({ workout, onClose, onDeleted }: { workout: Workout; onClose: () => void; onDeleted: () => void }) {
  async function remove() {
    if (!confirm('Training löschen?')) return
    await api.delete(`/workouts/${workout.id}`)
    onDeleted()
  }

  return (
    <Sheet title={workout.title} onClose={onClose}>
      <div className="stack">
        <p className="muted small">
          {formatDate(workout.date)} · {workout.durationMin} Minuten
          {workout.cardioMinutes ? ` · ${workout.cardioMinutes} Min. Cardio` : ''}
        </p>
        {workout.exercises.map((e) => (
          <div key={e.exerciseId} className="card">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{exerciseById(e.exerciseId)?.name ?? e.exerciseId}</div>
            <div className="chips">
              {e.sets.map((s, i) => (
                <span key={i} className="chip num">
                  {s.weight ? `${formatKg(s.weight)} × ` : ''}
                  {s.reps}
                </span>
              ))}
            </div>
          </div>
        ))}
        <button className="btn danger block" onClick={remove}>
          Training löschen
        </button>
      </div>
    </Sheet>
  )
}

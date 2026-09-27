import { useState } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { ErrorText, PageHeader, Sheet } from '../components/ui'
import { DecimalInput } from '../components/fields'
import { BarChart, LineChart } from '../components/charts'
import { useMe } from '../state/app'
import { useAction, useFood, useWeights, useWorkoutCount, useWorkouts } from '../lib/hooks'
import { api } from '../lib/api'
import { addDays, dayKey, formatDate, startOfDay, weekdayIndex } from '../lib/dates'
import { exerciseById, weeklyLoad } from '../lib/plan'
import { formatKg, formatNumber } from '../lib/format'
import { WEEKDAYS_SHORT } from '../lib/labels'
import type { WeightEntry, Workout } from '../lib/types'

// average of the last up to 7 entries, so daily water swings don't hide the trend
function withTrend(weights: WeightEntry[]) {
  return weights.map((w, i) => {
    const window = weights.slice(Math.max(0, i - 6), i + 1)
    return { ...w, trend: Math.round((window.reduce((s, x) => s + x.kg, 0) / window.length) * 10) / 10 }
  })
}

export function ProgressPage() {
  const { me, targets, saveProfile } = useMe()
  const weights = useWeights()
  const workouts = useWorkouts(30)
  const workoutCount = useWorkoutCount()
  const today = startOfDay(new Date())
  const weekStart = addDays(today, -6)
  const food = useFood(weekStart, 7)
  const [weightInput, setWeightInput] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [openWorkout, setOpenWorkout] = useState<Workout | null>(null)
  const weightAction = useAction()

  async function saveWeight() {
    const kg = weightInput
    if (kg == null || !(kg > 20 && kg < 400)) return weightAction.setError('Bitte ein Gewicht zwischen 20 und 400 kg eintragen.')
    const ok = await weightAction.run(async () => {
      await api.post('/weights', { date: dayKey(), kg })
      // the current weight also updates the calorie targets
      await saveProfile({ ...me.profile, weightKg: kg })
    })
    if (ok) {
      setWeightInput(null)
      weights.reload()
    }
  }

  async function deleteWeight(id: number) {
    if (await weightAction.run(() => api.delete(`/weights/${id}`))) weights.reload()
  }

  // this week
  const monday = addDays(today, -weekdayIndex(today))
  const thisWeek = workouts.data.filter((w) => new Date(w.date) >= monday).length
  const plannedPerWeek = weeklyLoad(me.plan).strengthSessions

  // weight chart
  const trend = withTrend(weights.data)
  const weightPoints = trend.slice(-60).map((w) => ({ label: formatDate(w.date, { day: '2-digit', month: '2-digit' }), value: w.kg, trend: w.trend }))
  const firstWeight = weights.data[0]?.kg
  const current = trend[trend.length - 1]
  const weekAgo = trend.filter((w) => w.date <= dayKey(addDays(today, -7))).pop()

  // calories of the last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i)
    const entries = food.data.filter((f) => dayKey(new Date(f.eatenAt)) === dayKey(day))
    return {
      label: WEEKDAYS_SHORT[weekdayIndex(day)],
      kcal: entries.reduce((sum, f) => sum + f.kcal, 0),
      protein: entries.reduce((sum, f) => sum + f.protein, 0),
    }
  })
  const tracked = days.filter((d) => d.kcal > 0)
  const avgKcal = tracked.length ? tracked.reduce((s, d) => s + d.kcal, 0) / tracked.length : 0
  const avgProtein = tracked.length ? tracked.reduce((s, d) => s + d.protein, 0) / tracked.length : 0

  return (
    <div className="page">
      <PageHeader title="Fortschritt" />

      <div className="grid-3">
        <div className="card stat">
          <span className="value num">
            {thisWeek}
            <span className="muted" style={{ fontSize: 15 }}>
              /{plannedPerWeek}
            </span>
          </span>
          <span className="label">Diese Woche</span>
        </div>
        <div className="card stat">
          <span className="value num">{formatNumber(avgKcal)}</span>
          <span className="label">Ø kcal (7 Tage)</span>
        </div>
        <div className="card stat">
          <span className="value num">{workoutCount.data}</span>
          <span className="label">Trainings gesamt</span>
        </div>
      </div>

      {/* body weight */}
      <div className="card stack">
        <div className="spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="card-label">Gewicht</div>
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span className="big-number" style={{ fontSize: 32 }}>
                {formatNumber(current?.trend ?? me.profile.weightKg, 1)}
              </span>
              <span className="muted">kg Ø</span>
            </div>
          </div>
          <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
            {current && weekAgo && (
              <span className="chip num">
                {current.trend - weekAgo.trend > 0 ? '+' : ''}
                {formatNumber(current.trend - weekAgo.trend, 1)} kg / Woche
              </span>
            )}
            {firstWeight != null && current && weights.data.length > 1 && (
              <span className="muted tiny num">
                {current.kg - firstWeight > 0 ? '+' : ''}
                {formatNumber(current.kg - firstWeight, 1)} kg seit Start
              </span>
            )}
          </div>
        </div>
        {weightPoints.length > 1 ? (
          <>
            <LineChart points={weightPoints} unit="kg" />
            <p className="muted tiny">Linie: Durchschnitt der letzten 7 Einträge · Punkte: einzelne Messungen</p>
          </>
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
          <DecimalInput aria-label="Gewicht heute in kg" placeholder="Gewicht heute (kg)" value={weightInput} onChange={setWeightInput} />
          <button className="btn" disabled={weightInput == null || weightAction.busy}>
            Speichern
          </button>
        </form>
        <ErrorText>{weightAction.error}</ErrorText>
        {weights.data.length > 0 && (
          <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Weniger anzeigen' : 'Alle Einträge'}
          </button>
        )}
        {showAll && (
          <div className="card tight" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
            {[...weights.data].reverse().map((w) => (
              <div key={w.id} className="list-item" style={{ padding: '4px 4px 4px 14px' }}>
                <span className="grow small">{formatDate(w.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="num small">{formatKg(w.kg)}</span>
                <button className="icon-btn" onClick={() => w.id && deleteWeight(w.id)} aria-label={`Eintrag vom ${formatDate(w.date)} löschen`}>
                  <Trash2 size={16} color="var(--text-3)" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* calories */}
      <div className="card stack">
        <div className="spread">
          <div className="card-label">Kalorien, letzte 7 Tage</div>
          {tracked.length > 0 && (
            <span className="muted small num">
              Ø {formatNumber(avgProtein)} / {targets.protein} g Eiweiß
            </span>
          )}
        </div>
        <BarChart points={days.map((d) => ({ label: d.label, value: d.kcal }))} target={targets.kcal} unit="kcal" />
      </div>

      {/* history */}
      <h2 className="section-title">Trainings</h2>
      <ErrorText>{workouts.error}</ErrorText>
      {workouts.data.length === 0 ? (
        <p className="empty">Noch kein Training gespeichert. Dein erstes wartet im Plan.</p>
      ) : (
        <div className="card tight">
          {workouts.data.map((w) => (
            <button key={w.id} className="list-item" onClick={() => setOpenWorkout(w)}>
              <div className="grow">
                <div className="strong">{w.title}</div>
                <div className="muted small">
                  {formatDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {w.durationMin} Min. ·{' '}
                  {w.exercises.reduce((n, e) => n + e.sets.length, 0)} Sätze
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
            workoutCount.reload()
          }}
        />
      )}
    </div>
  )
}

function WorkoutDetails({ workout, onClose, onDeleted }: { workout: Workout; onClose: () => void; onDeleted: () => void }) {
  const action = useAction()

  async function remove() {
    if (!confirm('Training löschen?')) return
    if (await action.run(() => api.delete(`/workouts/${workout.id}`))) onDeleted()
  }

  return (
    <Sheet
      title={workout.title}
      onClose={onClose}
      footer={
        <div className="stack tight">
          <ErrorText>{action.error}</ErrorText>
          <button className="btn danger block" onClick={remove} disabled={action.busy}>
            Training löschen
          </button>
        </div>
      }
    >
      <div className="stack">
        <p className="muted small">
          {formatDate(workout.date)} · {workout.durationMin} Min.
          {workout.cardioMinutes ? ` · ${workout.cardioMinutes} Min. Cardio` : ''}
        </p>
        {workout.exercises.map((e) => (
          <div key={e.exerciseId} className="card">
            <div className="strong" style={{ marginBottom: 6 }}>
              {exerciseById(e.exerciseId)?.name ?? e.exerciseId}
            </div>
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
      </div>
    </Sheet>
  )
}

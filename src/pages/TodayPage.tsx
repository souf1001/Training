import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Dumbbell, Footprints, HeartPulse, Play, Plus } from 'lucide-react'
import { MacroBar, PageHeader, Ring, Sheet, Tip } from '../components/ui'
import { CoachCard } from '../components/CoachCard'
import { useMe } from '../state/app'
import { useFood, useWorkouts } from '../lib/hooks'
import { addDays, dayKey, formatDate, startOfDay, weekdayIndex } from '../lib/dates'
import { formatNumber } from '../lib/format'
import { sumMacros } from '../lib/nutrition'
import { tipFor } from '../lib/tips'
import { WEEKDAYS, WEEKDAYS_SHORT } from '../lib/labels'
import { aiEnabled } from '../lib/ai'

// the food table is only loaded when you open the sheet
const FoodLogSheet = lazy(() => import('../components/FoodLogSheet').then((m) => ({ default: m.FoodLogSheet })))

export function TodayPage() {
  const { me, targets } = useMe()
  const today = startOfDay(new Date())
  const todayIndex = weekdayIndex(today)
  const food = useFood(today)
  const workouts = useWorkouts(14)
  const [logging, setLogging] = useState(false)
  const [picking, setPicking] = useState(false)

  const eaten = sumMacros(food.data)
  const left = targets.kcal - eaten.kcal
  const planDay = me.plan.days.find((d) => d.weekday === todayIndex)
  const nextDay = [1, 2, 3, 4, 5, 6].map((n) => me.plan.days.find((d) => d.weekday === (todayIndex + n) % 7)).find(Boolean)
  const monday = addDays(today, -todayIndex)
  const createdDay = dayKey(new Date(me.createdAt.replace(' ', 'T') + 'Z'))

  // days of this week with a finished workout
  const workoutDays = new Set(workouts.data.map((w) => dayKey(new Date(w.date))))
  const doneDays = [0, 1, 2, 3, 4, 5, 6].filter((i) => workoutDays.has(dayKey(addDays(monday, i))))
  const doneToday = doneDays.includes(todayIndex)

  return (
    <div className="page">
      <PageHeader eyebrow={formatDate(today)} title="Heute" />

      {/* week overview */}
      <div className="card">
        <div className="week">
          {WEEKDAYS_SHORT.map((label, i) => {
            const planned = me.plan.days.find((d) => d.weekday === i)
            const done = doneDays.includes(i)
            // only days since the account exists count as missed
            const missed = Boolean(planned) && !done && i < todayIndex && dayKey(addDays(monday, i)) >= createdDay
            const Icon = planned?.exercises.length ? Dumbbell : HeartPulse
            return (
              <div key={i} className={`day ${i === todayIndex ? 'today' : ''}`}>
                {label}
                <span
                  className={`dot ${done ? 'done' : missed ? 'missed' : planned ? 'planned' : ''}`}
                  aria-label={done ? 'erledigt' : missed ? 'verpasst' : planned ? planned.title : 'Ruhetag'}
                >
                  {done ? <Check size={16} strokeWidth={3} /> : planned ? <Icon size={14} /> : null}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* today's training */}
      {planDay ? (
        <div className="card stack">
          <Link to={`/plan/${planDay.weekday}`} className="stack" style={{ color: 'inherit' }}>
            <div className="spread">
              <div className="card-label">{doneToday ? 'Erledigt' : 'Training heute'}</div>
              <ChevronRight size={20} color="var(--text-3)" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{planDay.title}</div>
              <div className="muted">{planDay.focus}</div>
            </div>
            <div className="chips">
              {planDay.exercises.length > 0 && (
                <span className="chip">
                  <Dumbbell size={14} /> {planDay.exercises.length} Übungen · ca. {me.profile.sessionMinutes} Min.
                </span>
              )}
              {planDay.cardio && (
                <span className="chip">
                  <HeartPulse size={14} /> {planDay.cardio.minutes} Min. Cardio
                </span>
              )}
            </div>
          </Link>
          {!doneToday && (
            <Link to={`/training/${planDay.weekday}`} className="btn block">
              <Play size={18} fill="currentColor" /> {planDay.exercises.length > 0 ? 'Training starten' : 'Cardio starten'}
            </Link>
          )}
        </div>
      ) : (
        <div className="card stack">
          <div className="card-label">Ruhetag</div>
          <p>Heute steht kein Training an. Erholung gehört dazu: Hier wachsen deine Muskeln.</p>
          <div className="row small muted">
            <Footprints size={18} /> Ziel: {formatNumber(me.plan.stepsGoal)} Schritte
          </div>
          {nextDay && (
            <p className="small muted">
              Als Nächstes: <strong style={{ color: 'var(--text)' }}>{nextDay.title}</strong> am {WEEKDAYS[nextDay.weekday]}
            </p>
          )}
          {me.plan.days.length > 0 && (
            <button className="btn secondary block" onClick={() => setPicking(true)}>
              Trotzdem trainieren
            </button>
          )}
        </div>
      )}

      {/* calories */}
      <div className="card stack">
        <div className="spread">
          <div className="card-label">Ernährung</div>
          <Link to="/essen" className="small" style={{ padding: '10px 0' }}>
            Details
          </Link>
        </div>
        <div className="nutrition-row">
          <Ring value={eaten.kcal} max={targets.kcal}>
            <span className="num" style={{ fontSize: 26, fontWeight: 750, letterSpacing: '-0.02em' }}>
              {formatNumber(Math.abs(left))}
            </span>
            <span className="muted tiny">{left >= 0 ? 'kcal übrig' : 'kcal drüber'}</span>
          </Ring>
          <div className="macros">
            <MacroBar label="Eiweiß" value={eaten.protein} target={targets.protein} color="var(--protein)" />
            <MacroBar label="Kohlenhydrate" value={eaten.carbs} target={targets.carbs} color="var(--carbs)" />
            <MacroBar label="Fett" value={eaten.fat} target={targets.fat} color="var(--fat)" />
          </div>
        </div>
        <button className="btn block" onClick={() => setLogging(true)}>
          <Plus size={20} /> Essen tracken
        </button>
      </div>

      <Tip>{tipFor(me.profile.goal, 'today')}</Tip>

      {aiEnabled() && <CoachCard />}

      {logging && (
        <Suspense fallback={null}>
          <FoodLogSheet onClose={() => setLogging(false)} onSaved={food.reload} />
        </Suspense>
      )}
      {picking && (
        <Sheet title="Welchen Tag trainierst du?" onClose={() => setPicking(false)}>
          <div className="card tight">
            {me.plan.days.map((d) => (
              <Link key={d.weekday} to={`/training/${d.weekday}`} className="list-item">
                <div className="grow">
                  <div className="strong">{d.title}</div>
                  <div className="muted small">
                    {WEEKDAYS[d.weekday]} · {d.exercises.length > 0 ? d.focus : `${d.cardio?.minutes} Min. Cardio`}
                  </div>
                </div>
                <ChevronRight size={18} className="chev" />
              </Link>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}

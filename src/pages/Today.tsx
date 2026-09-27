import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Dumbbell, Footprints, HeartPulse, Plus } from 'lucide-react'
import { MacroBar, PageHeader, Ring, Tip, formatNumber } from '../components/ui'
import { FoodLogSheet } from '../components/FoodLogSheet'
import { CoachCard } from '../components/CoachCard'
import { useMe } from '../state/app'
import { useFood, useWorkouts } from '../lib/hooks'
import { addDays, dayKey, formatDate, startOfDay, weekdayIndex } from '../lib/dates'
import { sumMacros } from '../lib/nutrition'
import { tipFor } from '../lib/tips'
import { WEEKDAYS_SHORT } from '../lib/labels'
import { aiEnabled } from '../lib/ai'

export function Today() {
  const { me, targets } = useMe()
  const today = startOfDay(new Date())
  const food = useFood(today)
  const recentFood = useFood(addDays(today, -14), 15)
  const workouts = useWorkouts(30)
  const [logging, setLogging] = useState(false)

  const eaten = sumMacros(food.data)
  const left = targets.kcal - eaten.kcal
  const planDay = me.plan.days.find((d) => d.weekday === weekdayIndex(today))
  const monday = addDays(today, -weekdayIndex(today))

  // days of this week with a finished workout
  const workoutDays = new Set(workouts.data.map((w) => dayKey(new Date(w.date))))
  const doneDays = [0, 1, 2, 3, 4, 5, 6].filter((i) => workoutDays.has(dayKey(addDays(monday, i))))
  const doneToday = doneDays.includes(weekdayIndex(today))

  return (
    <div className="page">
      <PageHeader eyebrow={formatDate(today)} title="Heute" />

      {/* week overview */}
      <div className="card">
        <div className="week">
          {WEEKDAYS_SHORT.map((label, i) => {
            const planned = me.plan.days.find((d) => d.weekday === i)
            const done = doneDays.includes(i)
            const PlannedIcon = planned?.exercises.length ? Dumbbell : HeartPulse
            return (
              <div key={i} className={`day ${i === weekdayIndex(today) ? 'today' : ''}`}>
                {label}
                <span className={`dot ${done ? 'done' : planned ? 'planned' : ''}`}>
                  {done ? <Check size={16} strokeWidth={3} /> : planned ? <PlannedIcon size={14} /> : null}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* today's training */}
      {planDay ? (
        <Link to={`/plan/${planDay.weekday}`} className="card stack" style={{ color: 'inherit' }}>
          <div className="spread">
            <div className="card-label">{doneToday ? 'Erledigt' : 'Training heute'}</div>
            <ChevronRight size={20} className="chev" color="var(--text-3)" />
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
          {!doneToday && <span className="btn block">{planDay.exercises.length > 0 ? 'Training ansehen' : 'Cardio ansehen'}</span>}
        </Link>
      ) : (
        <div className="card stack">
          <div className="card-label">Ruhetag</div>
          <p>Heute steht kein Training an. Erholung gehört dazu: Hier wachsen deine Muskeln.</p>
          <div className="row small muted">
            <Footprints size={18} /> Ziel: {formatNumber(me.plan.stepsGoal)} Schritte
          </div>
        </div>
      )}

      {/* calories */}
      <div className="card stack">
        <div className="spread">
          <div className="card-label">Ernährung</div>
          <Link to="/essen" className="small">
            Details
          </Link>
        </div>
        <div className="row" style={{ gap: 20 }}>
          <Ring value={eaten.kcal} max={targets.kcal}>
            <span className="num" style={{ fontSize: 26, fontWeight: 750, letterSpacing: '-0.02em' }}>
              {formatNumber(Math.abs(left))}
            </span>
            <span className="muted tiny">{left >= 0 ? 'kcal übrig' : 'kcal drüber'}</span>
          </Ring>
          <div className="stack" style={{ flex: 1, gap: 10 }}>
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

      {logging && <FoodLogSheet onClose={() => setLogging(false)} onSaved={food.reload} recent={recentFood.data} />}
    </div>
  )
}

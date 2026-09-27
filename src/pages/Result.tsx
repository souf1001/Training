// Result of the profile check: calories, macros and the plan preview.
import { Link, Navigate } from 'react-router-dom'
import { Dumbbell, Footprints, HeartPulse } from 'lucide-react'
import { BackBar, Tip, formatNumber } from '../components/ui'
import { cardioMinutes, loadDraft } from '../state/app'
import { bmi, calcTargets, DIET_STYLES, GOAL_ADJUST } from '../lib/nutrition'
import { generatePlan } from '../lib/plan'
import { GOALS, WEEKDAYS } from '../lib/labels'

export function Result() {
  const profile = loadDraft()
  if (!profile) return <Navigate to="/start" replace />

  const plan = generatePlan(profile)

  const targets = calcTargets(profile, cardioMinutes(plan))
  const difference = targets.kcal - targets.tdee
  const bodyMassIndex = bmi(profile)

  return (
    <div className="page no-tabs">
      <BackBar to="/start" />
      <div className="stack" style={{ gap: 4 }}>
        <div className="card-label">Dein Ergebnis</div>
        <h1 className="title">{GOALS[profile.goal].label}</h1>
      </div>

      <div className="card stack">
        <div className="card-label">Kalorien pro Tag</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
          <span className="big-number">{formatNumber(targets.kcal)}</span>
          <span className="muted">kcal</span>
        </div>
        <div className="grid-2">
          <div className="stat">
            <span className="value">{formatNumber(targets.bmr)}</span>
            <span className="label">Grundumsatz</span>
          </div>
          <div className="stat">
            <span className="value">{formatNumber(targets.tdee)}</span>
            <span className="label">Gesamtverbrauch</span>
          </div>
        </div>
        <p className="muted small">
          {GOAL_ADJUST[profile.goal] === 0
            ? 'Du isst so viel, wie du verbrauchst, und hältst dein Gewicht.'
            : difference < 0
              ? `Du isst ${formatNumber(-difference)} kcal weniger, als du verbrauchst. Das sind etwa ${formatNumber((-difference * 7) / 7700, 1)} kg Fett pro Woche.`
              : `Du isst ${formatNumber(difference)} kcal mehr, als du verbrauchst, damit deine Muskeln wachsen können.`}
        </p>
      </div>

      <div className="card stack">
        <div className="spread">
          <div className="card-label">Makros</div>
          <span className="chip">{DIET_STYLES[profile.dietStyle].label}</span>
        </div>
        <div className="grid-3">
          <Macro label="Eiweiß" grams={targets.protein} color="var(--protein)" />
          <Macro label="Kohlenhydr." grams={targets.carbs} color="var(--carbs)" />
          <Macro label="Fett" grams={targets.fat} color="var(--fat)" />
        </div>
        <p className="muted small">
          BMI {formatNumber(bodyMassIndex, 1)}. Der BMI sagt nichts über Muskeln aus, er ist nur ein grober Anhaltspunkt.
        </p>
      </div>

      <div className="card tight">
        <div style={{ padding: '16px 16px 4px' }}>
          <div className="card-label">Dein Trainingsplan</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>{plan.splitName}</div>
        </div>
        {plan.days.map((day) => (
          <div className="list-item" key={day.weekday} style={{ cursor: 'default' }}>
            <span className="muted small" style={{ width: 84 }}>
              {WEEKDAYS[day.weekday]}
            </span>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{day.title}</div>
              <div className="muted small">
                {[day.exercises.length > 0 && `${day.exercises.length} Übungen`, day.cardio && `${day.cardio.minutes} Min. Cardio`]
                  .filter(Boolean)
                  .join(' + ')}
              </div>
            </div>
            {day.exercises.length > 0 ? <Dumbbell size={18} className="chev" /> : <HeartPulse size={18} className="chev" />}
          </div>
        ))}
        <div className="list-item" style={{ cursor: 'default' }}>
          <Footprints size={18} className="chev" />
          <span className="grow small">Jeden Tag etwa {formatNumber(plan.stepsGoal)} Schritte</span>
        </div>
      </div>

      <Tip>Mit einem kostenlosen Konto werden dein Plan, dein Training und dein Essen gespeichert, auf all deinen Geräten.</Tip>

      <div className="stack" style={{ position: 'sticky', bottom: 'calc(var(--safe-bottom) + 16px)' }}>
        <Link to="/registrieren" className="btn block">
          Konto erstellen & Plan speichern
        </Link>
      </div>
      <Link to="/login" className="btn ghost block">
        Ich habe schon ein Konto
      </Link>
    </div>
  )
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <div className="stat">
      <span className="value" style={{ color }}>
        {grams} g
      </span>
      <span className="label">{label}</span>
    </div>
  )
}

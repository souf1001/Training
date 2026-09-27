import { Link } from 'react-router-dom'
import { ChevronRight, Footprints, HeartPulse, RefreshCw } from 'lucide-react'
import { ErrorText, PageHeader, Spinner } from '../components/ui'
import { useAction } from '../lib/hooks'
import { formatNumber } from '../lib/format'
import { useMe } from '../state/app'
import { generatePlan } from '../lib/plan'
import { weekdayIndex } from '../lib/dates'
import { WEEKDAYS_SHORT } from '../lib/labels'

export function PlanPage() {
  const { me, savePlan } = useMe()
  const action = useAction()
  const today = weekdayIndex()

  async function regenerate() {
    if (!confirm('Plan neu erstellen? Getauschte Übungen werden zurückgesetzt.')) return
    await action.run(() => savePlan(generatePlan(me.profile)))
  }

  return (
    <div className="page">
      <PageHeader eyebrow={me.plan.splitName} title="Dein Plan" />

      <div className="card tight">
        {WEEKDAYS_SHORT.map((short, weekday) => {
          const day = me.plan.days.find((d) => d.weekday === weekday)
          const content = (
            <>
              <div style={{ width: 36 }}>
                <div className={`small ${weekday === today ? '' : 'muted'}`} style={{ fontWeight: 700, color: weekday === today ? 'var(--accent)' : undefined }}>
                  {short}
                </div>
              </div>
              <div className="grow">
                <div style={{ fontWeight: day ? 600 : 400, color: day ? undefined : 'var(--text-3)' }}>{day ? day.title : 'Ruhetag'}</div>
                {day && (
                  <div className="muted small">
                    {[day.exercises.length > 0 && day.focus, day.cardio && `${day.cardio.minutes} Min. Cardio`].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              {day && <ChevronRight size={20} className="chev" />}
            </>
          )
          return day ? (
            <Link key={weekday} to={`/plan/${weekday}`} className="list-item" style={{ color: 'inherit' }}>
              {content}
            </Link>
          ) : (
            <div key={weekday} className="list-item" style={{ cursor: 'default' }}>
              {content}
            </div>
          )
        })}
      </div>

      <div className="grid-2">
        <div className="card stat">
          <HeartPulse size={20} color="var(--accent)" />
          <span className="value">{me.plan.cardioPerWeek}×</span>
          <span className="label">Cardio pro Woche</span>
        </div>
        <div className="card stat">
          <Footprints size={20} color="var(--accent)" />
          <span className="value">{formatNumber(me.plan.stepsGoal)}</span>
          <span className="label">Schritte am Tag</span>
        </div>
      </div>

      <h2 className="section-title">So trainierst du richtig</h2>
      <div className="card">
        <ul className="bullets">
          {me.plan.notes.map((note) => (
            <li key={note}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      <button className="btn secondary block" onClick={regenerate} disabled={action.busy}>
        {action.busy ? <Spinner /> : <><RefreshCw size={18} /> Plan neu erstellen</>}
      </button>
      <ErrorText>{action.error}</ErrorText>
      <p className="muted small" style={{ textAlign: 'center' }}>
        Trainingstage, Ziel oder Equipment änderst du unter <Link to="/profil">Profil</Link>.
      </p>
    </div>
  )
}

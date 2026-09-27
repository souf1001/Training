import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, ChevronRight, HeartPulse, Info, Play } from 'lucide-react'
import { BackBar, ErrorText, Sheet, Tip } from '../components/ui'
import { ExerciseThumb } from '../components/ExerciseMedia'
import { useMe } from '../state/app'
import { useAction } from '../lib/hooks'
import { alternatives, exerciseById, prescribe } from '../lib/plan'
import { formatEffort, formatRest, formatSetsReps } from '../lib/format'
import { EQUIPMENT_LABEL, WEEKDAYS } from '../lib/labels'
import { tipFor } from '../lib/tips'

export function DayPage() {
  const { weekday } = useParams()
  const { me, savePlan } = useMe()
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const [explain, setExplain] = useState(false)
  const swapAction = useAction()
  const day = me.plan.days.find((d) => d.weekday === Number(weekday))
  if (!day) return <Navigate to="/plan" replace />

  async function swap(index: number, exerciseId: string) {
    const exercise = exerciseById(exerciseId)!
    const days = me.plan.days.map((d) =>
      d.weekday === day!.weekday ? { ...d, exercises: d.exercises.map((pe, i) => (i === index ? prescribe(exercise, me.profile) : pe)) } : d,
    )
    if (await swapAction.run(() => savePlan({ ...me.plan, days }))) setSwapIndex(null)
  }

  return (
    <div className="page" style={{ paddingBottom: 'calc(var(--tabbar) + 8px)' }}>
      <BackBar to="/plan" />
      <div className="stack" style={{ gap: 4 }}>
        <div className="card-label">{WEEKDAYS[day.weekday]}</div>
        <h1 className="title">{day.title}</h1>
        <p className="muted">{day.focus}</p>
      </div>

      {day.exercises.length > 0 && (
        <>
          <div className="spread">
            <span className="card-label">{day.exercises.length} Übungen</span>
            <button className="btn ghost small" onClick={() => setExplain(true)}>
              <Info size={16} /> Was bedeutet „in Reserve“?
            </button>
          </div>
          <div className="card tight">
            {day.exercises.map((pe, i) => {
              const exercise = exerciseById(pe.exerciseId)
              if (!exercise) return null
              return (
                <div key={i} className="list-item" style={{ paddingRight: 8 }}>
                  <Link to={`/uebung/${exercise.id}`} className="row grow" style={{ color: 'inherit', minWidth: 0 }}>
                    <ExerciseThumb exercise={exercise} />
                    <div style={{ minWidth: 0 }}>
                      <div className="strong clamp-2">{exercise.name}</div>
                      <div className="muted small num">
                        {formatSetsReps(pe, exercise)} · {formatRest(pe.restSec)} Pause
                      </div>
                      <div className="muted tiny">{formatEffort(pe, exercise)}</div>
                    </div>
                  </Link>
                  <button className="icon-btn" onClick={() => setSwapIndex(i)} aria-label={`${exercise.name} tauschen`}>
                    <ArrowLeftRight size={18} color="var(--text-3)" />
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {day.cardio && (
        <div className="card stack">
          <div className="row tight card-label">
            <HeartPulse size={14} /> Cardio {day.exercises.length > 0 && 'nach dem Krafttraining'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {day.cardio.minutes} Minuten {day.cardio.intensity === 'intervals' ? 'Intervalle' : 'locker'}
          </div>
          <p className="muted">{day.cardio.note}</p>
        </div>
      )}

      <Tip>{tipFor(me.profile.goal, 'workout')}</Tip>

      <div className="sticky-cta above-tabs">
        <Link to={`/training/${day.weekday}`} className="btn block">
          <Play size={18} fill="currentColor" /> {day.exercises.length > 0 ? 'Training starten' : 'Cardio starten'}
        </Link>
      </div>

      {swapIndex !== null && (
        <Sheet title="Übung tauschen" onClose={() => setSwapIndex(null)}>
          <ErrorText>{swapAction.error}</ErrorText>
          <SwapList currentId={day.exercises[swapIndex].exerciseId} onPick={(id) => swap(swapIndex, id)} />
        </Sheet>
      )}

      {explain && (
        <Sheet title="Wiederholungen in Reserve" onClose={() => setExplain(false)}>
          <div className="stack">
            <p>
              <strong>„2 Wdh. in Reserve“</strong> heißt: Hör auf, wenn du noch 2 saubere Wiederholungen geschafft hättest. So trainierst du hart genug für
              Fortschritt, ohne dass die Technik leidet.
            </p>
            <p className="muted">
              Anfänger schätzen das oft zu vorsichtig ein. Wenn du dir unsicher bist: lieber 1 Wiederholung mehr als geplant, solange sie sauber ist.
            </p>
            <p className="muted">
              <strong>Bis zum Versagen</strong> heißt: so viele Wiederholungen, bis keine saubere mehr geht. Das machen wir nur bei kleinen Übungen im
              letzten Satz, nie bei schweren Grundübungen.
            </p>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function SwapList({ currentId, onPick }: { currentId: string; onPick: (id: string) => void }) {
  const { me } = useMe()
  const options = alternatives(currentId, me.profile)
  if (options.length === 0) return <p className="empty">Mit deinem Equipment gibt es keine Alternative für diese Übung.</p>
  return (
    <div className="card tight">
      {options.map((e) => (
        <button key={e.id} className="list-item" onClick={() => onPick(e.id)}>
          <ExerciseThumb exercise={e} />
          <div className="grow">
            <div className="strong">{e.name}</div>
            <div className="muted small">{e.equipment.length ? e.equipment.map((q) => EQUIPMENT_LABEL[q]).join(', ') : 'Ohne Geräte'}</div>
          </div>
          <ChevronRight size={18} className="chev" />
        </button>
      ))}
    </div>
  )
}

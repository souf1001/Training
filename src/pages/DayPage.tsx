import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, ChevronRight, HeartPulse, Play } from 'lucide-react'
import { BackBar, Sheet, Tip } from '../components/ui'
import { ExerciseThumb } from '../components/ExerciseMedia'
import { useMe } from '../state/app'
import { alternatives, exerciseById, prescribe } from '../lib/plan'
import { formatEffort, formatRest, formatSetsReps } from '../lib/format'
import { EQUIPMENT_LABEL, WEEKDAYS } from '../lib/labels'
import { tipFor } from '../lib/tips'

export function DayPage() {
  const { weekday } = useParams()
  const { me, savePlan } = useMe()
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const day = me.plan.days.find((d) => d.weekday === Number(weekday))
  if (!day) return <Navigate to="/plan" replace />

  async function swap(index: number, exerciseId: string) {
    const exercise = exerciseById(exerciseId)!
    const days = me.plan.days.map((d) =>
      d.weekday === day!.weekday ? { ...d, exercises: d.exercises.map((pe, i) => (i === index ? prescribe(exercise, me.profile) : pe)) } : d,
    )
    await savePlan({ ...me.plan, days })
    setSwapIndex(null)
  }

  return (
    <div className="page">
      <BackBar to="/plan" />
      <div className="stack" style={{ gap: 4 }}>
        <div className="card-label">{WEEKDAYS[day.weekday]}</div>
        <h1 className="title">{day.title}</h1>
        <p className="muted">{day.focus}</p>
      </div>

      {day.exercises.length > 0 && (
        <>
          <div className="card tight">
            {day.exercises.map((pe, i) => {
              const exercise = exerciseById(pe.exerciseId)
              if (!exercise) return null
              return (
                <div key={i} className="list-item" style={{ paddingRight: 8 }}>
                  <Link to={`/uebung/${exercise.id}`} className="row grow" style={{ color: 'inherit', minWidth: 0 }}>
                    <ExerciseThumb exercise={exercise} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }} className="truncate">
                        {exercise.name}
                      </div>
                      <div className="muted small num">
                        {formatSetsReps(pe, exercise)} · {formatRest(pe.restSec)} Pause
                      </div>
                      <div className="muted tiny">{formatEffort(pe)}</div>
                    </div>
                  </Link>
                  <button className="icon-btn" onClick={() => setSwapIndex(i)} aria-label="Übung tauschen">
                    <ArrowLeftRight size={18} color="var(--text-3)" />
                  </button>
                </div>
              )
            })}
          </div>
          <Link to={`/training/${day.weekday}`} className="btn block">
            <Play size={18} fill="currentColor" /> Training starten
          </Link>
        </>
      )}

      {day.cardio && (
        <div className="card stack">
          <div className="row card-label" style={{ gap: 6 }}>
            <HeartPulse size={14} /> Cardio {day.exercises.length > 0 && 'nach dem Krafttraining'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {day.cardio.minutes} Minuten {day.cardio.intensity === 'intervals' ? 'Intervalle' : 'locker'}
          </div>
          <p className="muted">{day.cardio.note}</p>
          {day.exercises.length === 0 && (
            <Link to={`/training/${day.weekday}`} className="btn block">
              <Play size={18} fill="currentColor" /> Cardio starten
            </Link>
          )}
        </div>
      )}

      <Tip>{tipFor(me.profile.goal, 'workout')}</Tip>

      {swapIndex !== null && (
        <Sheet title="Übung tauschen" onClose={() => setSwapIndex(null)}>
          <SwapList currentId={day.exercises[swapIndex].exerciseId} onPick={(id) => swap(swapIndex, id)} />
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
            <div style={{ fontWeight: 600 }}>{e.name}</div>
            <div className="muted small">{e.equipment.length ? e.equipment.map((q) => EQUIPMENT_LABEL[q]).join(', ') : 'Ohne Geräte'}</div>
          </div>
          <ChevronRight size={18} className="chev" />
        </button>
      ))}
    </div>
  )
}

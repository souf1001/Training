import { Navigate, useParams } from 'react-router-dom'
import { CircleCheck, CircleX, Lightbulb, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { BackBar } from '../components/ui'
import { ExerciseMedia } from '../components/ExerciseMedia'
import { exerciseById } from '../lib/plan'
import { EQUIPMENT_LABEL, EXPERIENCE } from '../lib/labels'

export function ExercisePage() {
  const { id } = useParams()
  const exercise = exerciseById(id ?? '')
  if (!exercise) return <Navigate to="/plan" replace />

  return (
    <div className="page no-tabs">
      <BackBar />
      <ExerciseMedia exercise={exercise} />

      <div className="stack" style={{ gap: 8 }}>
        <h1 className="title" style={{ fontSize: 28 }}>
          {exercise.name}
        </h1>
        <div className="chips">
          {exercise.primary.map((m) => (
            <span key={m} className="chip accent">
              {m}
            </span>
          ))}
          {exercise.secondary.map((m) => (
            <span key={m} className="chip">
              {m}
            </span>
          ))}
        </div>
        <p className="muted small">
          {exercise.equipment.length ? exercise.equipment.map((q) => EQUIPMENT_LABEL[q]).join(', ') : 'Ohne Geräte'} · ab {EXPERIENCE[exercise.level].label}
        </p>
      </div>

      <Section title="So geht's">
        <ol className="steps">
          {exercise.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Section>

      <Section title="Das solltest du spüren">
        <Bullets items={exercise.feel} icon={<CircleCheck size={18} color="var(--good)" />} />
      </Section>

      <Section title="Das solltest du nicht spüren">
        <Bullets items={exercise.notFeel} icon={<CircleX size={18} color="var(--bad)" />} />
      </Section>

      <Section title="Tipps">
        <Bullets items={exercise.tips} icon={<Lightbulb size={18} color="var(--accent)" />} />
      </Section>

      <Section title="Häufige Fehler">
        <Bullets items={exercise.mistakes} icon={<TriangleAlert size={18} color="var(--carbs)" />} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: 10 }}>
      <h2 className="section-title">{title}</h2>
      <div className="card">{children}</div>
    </section>
  )
}

function Bullets({ items, icon }: { items: string[]; icon: ReactNode }) {
  return (
    <ul className="bullets">
      {items.map((item) => (
        <li key={item}>
          {icon}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

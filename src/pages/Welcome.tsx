import { Link } from 'react-router-dom'
import { CalendarDays, Dumbbell, Flame, Utensils } from 'lucide-react'
import { Logo } from '../components/Logo'

const FEATURES = [
  { icon: CalendarDays, title: 'Plan, der zu dir passt', text: 'Nach Ziel, Trainingstagen, Erfahrung und Equipment. Gym oder Zuhause.' },
  { icon: Dumbbell, title: 'Jede Übung erklärt', text: 'Mit Animation, was du spüren solltest und was nicht.' },
  { icon: Flame, title: 'Cardio mit eingeplant', text: 'Passend zu deinem Ziel, mit Dauer und Puls.' },
  { icon: Utensils, title: 'Kalorien einfach tracken', text: 'Einfach eintippen oder einsprechen, was du gegessen hast.' },
]

export function Welcome() {
  return (
    <div className="welcome">
      <Logo />

      <div className="stack" style={{ gap: 28 }}>
        <div className="stack" style={{ gap: 12 }}>
          <h1 className="hero-title">
            Trainieren mit
            <br />
            Plan.
          </h1>
          <p className="muted" style={{ fontSize: 18 }}>
            Beantworte ein paar Fragen und bekomme deinen persönlichen Trainings- und Ernährungsplan.
          </p>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div className="feature" key={title}>
              <div className="icon">
                <Icon size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{title}</div>
                <div className="muted small">{text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stack">
        <Link to="/start" className="btn block">
          Los geht's
        </Link>
        <Link to="/login" className="btn ghost block">
          Ich habe schon ein Konto
        </Link>
      </div>
    </div>
  )
}

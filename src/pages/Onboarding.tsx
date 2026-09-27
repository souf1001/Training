// Profile check before registration: one question per screen.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { QUESTIONS } from '../components/questions'
import { ProgressBar } from '../components/ui'
import { DEFAULT_PROFILE, loadDraft, saveDraft } from '../state/app'
import type { Profile } from '../lib/types'

export function Onboarding() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile>(() => loadDraft() ?? DEFAULT_PROFILE)
  const [index, setIndex] = useState(0)

  const questions = QUESTIONS.filter((q) => !q.show || q.show(profile))
  const question = questions[index]
  const valid = !question.valid || question.valid(profile)

  function update(changes: Partial<Profile>) {
    const next = { ...profile, ...changes }
    setProfile(next)
    saveDraft(next) // keep answers if the page is reloaded
  }

  function next() {
    if (index < questions.length - 1) {
      setIndex(index + 1)
    } else {
      saveDraft(profile) // also when every default answer was kept
      navigate('/ergebnis')
    }
  }

  function back() {
    if (index > 0) setIndex(index - 1)
    else navigate('/')
  }

  return (
    <div className="page no-tabs" style={{ minHeight: '100dvh' }}>
      <div className="top-bar">
        <button className="icon-btn" onClick={back} aria-label="Zurück">
          <ChevronLeft size={26} />
        </button>
        <div style={{ flex: 1, padding: '0 8px' }}>
          <ProgressBar value={index + 1} max={questions.length} />
        </div>
        <span className="muted small num" style={{ width: 44, textAlign: 'center' }}>
          {index + 1}/{questions.length}
        </span>
      </div>

      <div className="stack" style={{ gap: 6, marginTop: 8 }}>
        <h1 className="title" style={{ fontSize: 28 }}>
          {question.title}
        </h1>
        {question.hint && <p className="muted">{question.hint}</p>}
      </div>

      <div style={{ flex: 1 }}>{question.render(profile, update)}</div>

      <div style={{ position: 'sticky', bottom: 'calc(var(--safe-bottom) + 16px)' }}>
        <button className="btn block" onClick={next} disabled={!valid}>
          {index < questions.length - 1 ? 'Weiter' : 'Ergebnis ansehen'}
        </button>
      </div>
    </div>
  )
}

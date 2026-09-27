// Profile check before registration: one question per screen.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { QUESTIONS } from '../components/questions'
import { ProgressBar } from '../components/ui'
import { DEFAULT_PROFILE, loadDraft, saveDraft } from '../state/app'
import type { Profile } from '../lib/types'

export function OnboardingPage() {
  const navigate = useNavigate()
  const [draft] = useState(loadDraft)
  const [profile, setProfile] = useState<Profile>(draft ?? DEFAULT_PROFILE)
  // questions without a preselected answer must be tapped (a saved draft counts as answered)
  const [answered, setAnswered] = useState<Set<string>>(() => new Set(draft ? QUESTIONS.map((q) => q.id) : []))
  const [index, setIndex] = useState(0)

  const questions = QUESTIONS.filter((q) => !q.show || q.show(profile))
  const question = questions[Math.min(index, questions.length - 1)]
  const unanswered = Boolean(question.required && !answered.has(question.id))
  const valid = !unanswered && (!question.valid || question.valid(profile))

  function update(changes: Partial<Profile>) {
    const next = { ...profile, ...changes }
    setProfile(next)
    setAnswered((set) => new Set(set).add(question.id))
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
    <div className="page no-tabs" style={{ minHeight: '100dvh', paddingBottom: 0 }}>
      <div className="top-bar">
        <button className="icon-btn" onClick={back} aria-label="Zurück">
          <ChevronLeft size={26} />
        </button>
        <div style={{ flex: 1, padding: '0 8px 0 4px' }}>
          <ProgressBar value={index + 1} max={questions.length} />
        </div>
      </div>

      <div className="stack tight" style={{ marginTop: 8 }}>
        <h1 className="title medium">{question.title}</h1>
        {question.hint && <p className="muted">{question.hint}</p>}
      </div>

      <div style={{ flex: 1 }} key={question.id}>
        {question.render(profile, update, unanswered)}
      </div>

      <div className="sticky-cta">
        <button className="btn block" onClick={next} disabled={!valid}>
          {index < questions.length - 1 ? 'Weiter' : 'Ergebnis ansehen'}
        </button>
      </div>
    </div>
  )
}

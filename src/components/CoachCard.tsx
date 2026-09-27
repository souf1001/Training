// Ask the AI coach a question (only shown in AI mode).
import { useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { Spinner } from './ui'
import { askCoach } from '../lib/ai'
import { useMe } from '../state/app'

export function CoachCard() {
  const { me, targets } = useMe()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)

  async function ask() {
    setBusy(true)
    setAnswer('')
    try {
      const context = `Tagesziel: ${targets.kcal} kcal, ${targets.protein} g Eiweiß. Trainingsplan: ${me.plan.splitName}, ${me.plan.days.map((d) => d.title).join(', ')}.`
      setAnswer(await askCoach(question, me.profile, context))
    } catch (err) {
      setAnswer((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <div className="row card-label" style={{ gap: 6 }}>
        <Sparkles size={14} /> KI-Coach
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (question.trim()) ask()
        }}
      >
        <input className="input" placeholder="z. B. Was esse ich vor dem Training?" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button className="icon-btn accent" style={{ width: 50, height: 50 }} disabled={busy || !question.trim()} aria-label="Fragen">
          {busy ? <Spinner /> : <Send size={20} />}
        </button>
      </form>
      {answer && <p style={{ whiteSpace: 'pre-wrap' }}>{answer}</p>}
    </div>
  )
}

// Register (takes over the answers from the profile check) and login.
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackBar, ErrorText, Sheet, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { dayKey } from '../lib/dates'
import { useAction } from '../lib/hooks'
import { generatePlan } from '../lib/plan'
import { loadDraft, saveDraft, useApp } from '../state/app'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { refresh } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [forgot, setForgot] = useState(false)
  const action = useAction()
  const [draft] = useState(loadDraft)
  const isRegister = mode === 'register'

  async function submit(e: FormEvent) {
    e.preventDefault()
    const ok = await action.run(async () => {
      if (isRegister) {
        // today's date on the phone, for the first weight entry
        await api.post('/auth/register', { email, password, profile: draft, plan: draft ? generatePlan(draft) : null, today: dayKey() })
        saveDraft(null)
      } else {
        await api.post('/auth/login', { email, password })
      }
      await refresh()
    })
    if (ok) navigate('/heute', { replace: true })
  }

  return (
    <div className="page no-tabs">
      <BackBar />
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="title">{isRegister ? 'Konto erstellen' : 'Willkommen zurück'}</h1>
        <p className="muted">
          {isRegister ? 'Deine Antworten aus dem Profil-Check werden übernommen.' : 'Melde dich mit deiner E-Mail an.'}
        </p>
      </div>

      {isRegister && !draft && (
        <div className="tip">
          <div>
            Du hast den Profil-Check noch nicht gemacht. <Link to="/start">Jetzt starten</Link>, damit dein Plan zu dir passt.
          </div>
        </div>
      )}

      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>E-Mail</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Passwort</span>
          <input
            className="input"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? 8 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isRegister && <small className="muted">Mindestens 8 Zeichen</small>}
        </label>
        <ErrorText>{action.error}</ErrorText>
        <button className="btn block" disabled={action.busy || (isRegister && !draft)}>
          {action.busy ? <Spinner /> : isRegister ? 'Konto erstellen' : 'Einloggen'}
        </button>
        {!isRegister && (
          <button type="button" className="btn ghost block" onClick={() => setForgot(true)}>
            Passwort vergessen?
          </button>
        )}
      </form>

      <p className="muted small" style={{ textAlign: 'center' }}>
        {isRegister ? (
          <>
            Schon registriert? <Link to="/login">Einloggen</Link>
          </>
        ) : (
          <>
            Neu hier? <Link to="/start">Profil-Check starten</Link>
          </>
        )}
      </p>

      {forgot && (
        <Sheet title="Passwort vergessen?" onClose={() => setForgot(false)}>
          <div className="stack">
            <p>Forma verschickt keine E-Mails. Bitte die Person, die Forma für dich betreibt, dein Passwort zurückzusetzen.</p>
            <p className="muted small">
              Für Betreiber: auf dem Server <code>npm run reset-password -- deine@email.de</code> ausführen. Das Programm zeigt ein neues Passwort an, das
              du danach unter Profil → Passwort ändern ersetzen kannst.
            </p>
          </div>
        </Sheet>
      )}
    </div>
  )
}

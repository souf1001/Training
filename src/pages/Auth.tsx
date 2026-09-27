// Register (takes over the answers from the profile check) and login.
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackBar } from '../components/ui'
import { api } from '../lib/api'
import { generatePlan } from '../lib/plan'
import { loadDraft, saveDraft, useApp } from '../state/app'

export function Auth({ mode }: { mode: 'login' | 'register' }) {
  const { refresh } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const draft = loadDraft()
  const isRegister = mode === 'register'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isRegister) {
        await api.post('/auth/register', { email, password, profile: draft, plan: draft ? generatePlan(draft) : null })
        saveDraft(null)
      } else {
        await api.post('/auth/login', { email, password })
      }
      await refresh()
      navigate('/heute', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
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
        {error && <p className="error">{error}</p>}
        <button className="btn block" disabled={busy || (isRegister && !draft)}>
          {busy ? '…' : isRegister ? 'Konto erstellen' : 'Einloggen'}
        </button>
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
    </div>
  )
}

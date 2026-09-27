import { useState, type ReactNode } from 'react'
import { ChevronRight, Download, LogOut, Share, Sparkles } from 'lucide-react'
import { ErrorText, PageHeader, Sheet } from '../components/ui'
import { DecimalInput, Segmented } from '../components/fields'
import { questionById } from '../components/questions'
import { AiSettingsSheet } from '../components/AiSettingsSheet'
import { changesPlan, clearLocalData, useMe } from '../state/app'
import { api } from '../lib/api'
import { useAction } from '../lib/hooks'
import { calcTargets } from '../lib/nutrition'
import { weeklyLoad } from '../lib/plan'
import { formatNumber } from '../lib/format'
import { findProvider } from '../lib/aiProviders'
import { loadAiSettings } from '../lib/ai'
import { applyTheme } from '../lib/theme'
import type { Theme } from '../lib/types'

const BODY = ['sex', 'age', 'height', 'weight', 'activity']
const TRAINING = ['goal', 'experience', 'location', 'equipment', 'days', 'duration', 'cardio']

type SheetName = 'kcal' | 'ai' | 'install' | 'password' | 'delete'

export function ProfilePage() {
  const { me, targets, logout, saveSettings } = useMe()
  const [editing, setEditing] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetName | null>(null)
  const [aiSettings, setAiSettings] = useState(loadAiSettings)
  const p = me.profile

  const rows = (ids: string[]) =>
    ids
      .filter((id) => id !== 'equipment' || p.location === 'home')
      .map((id) => {
        const q = questionById(id)
        return <Row key={id} label={q.label} value={q.summary(p)} onClick={() => setEditing(id)} />
      })

  function changeTheme(theme: Theme) {
    applyTheme(theme) // right away, even if saving fails (e.g. offline)
    saveSettings({ ...me.settings, theme }).catch(() => {})
  }

  return (
    <div className="page">
      <PageHeader title="Profil" />
      <p className="muted small" style={{ marginTop: -8 }}>
        {me.email}
      </p>

      <Group title="Körper">{rows(BODY)}</Group>
      <Group title="Ziel & Training">{rows(TRAINING)}</Group>
      <Group title="Ernährung">
        {rows(['diet'])}
        <Row label="Kalorienziel" value={`${formatNumber(targets.kcal)} kcal${p.kcalOverride ? ' (eigenes)' : ''}`} onClick={() => setSheet('kcal')} />
      </Group>

      <Group title="KI-Modus">
        <Row
          label={
            <span className="row tight">
              <Sparkles size={16} color="var(--accent-text)" /> KI-Anbieter
            </span>
          }
          value={aiSettings?.apiKey || aiSettings?.provider === 'custom' ? (findProvider(aiSettings.provider)?.name ?? aiSettings.provider) : 'Aus'}
          onClick={() => setSheet('ai')}
        />
      </Group>
      <p className="muted small" style={{ marginTop: -8, padding: '0 4px' }}>
        Ohne KI erkennt Forma Essen über eine eingebaute Tabelle und Open Food Facts. Mit eigenem API-Key schätzt eine KI Kalorien und Makros aus jedem Text.
      </p>

      <Group title="App">
        <div className="list-item">
          <span className="grow">Darstellung</span>
          <div style={{ width: 200 }}>
            <Segmented<Theme>
              label="Darstellung"
              value={me.settings.theme ?? 'system'}
              onChange={changeTheme}
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'light', label: 'Hell' },
                { value: 'dark', label: 'Dunkel' },
              ]}
            />
          </div>
        </div>
        <Row label="Als App installieren" value="" onClick={() => setSheet('install')} />
      </Group>

      <Group title="Konto">
        <a className="list-item" href="/api/export" download>
          <Download size={18} className="chev" />
          <span className="grow">Meine Daten exportieren</span>
        </a>
        <Row label="Passwort ändern" value="" onClick={() => setSheet('password')} />
        <button className="list-item" onClick={() => logout()}>
          <LogOut size={18} className="chev" />
          <span className="grow">Abmelden</span>
        </button>
        <button className="list-item" onClick={() => setSheet('delete')} style={{ color: 'var(--bad)' }}>
          <span className="grow">Konto löschen</span>
        </button>
      </Group>

      {editing && <EditQuestion id={editing} onClose={() => setEditing(null)} />}
      {sheet === 'kcal' && <KcalSheet onClose={() => setSheet(null)} />}
      {sheet === 'ai' && (
        <AiSettingsSheet
          onClose={() => {
            setSheet(null)
            setAiSettings(loadAiSettings())
          }}
        />
      )}
      {sheet === 'install' && <InstallSheet onClose={() => setSheet(null)} />}
      {sheet === 'password' && <PasswordSheet onClose={() => setSheet(null)} />}
      {sheet === 'delete' && <DeleteSheet onClose={() => setSheet(null)} />}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack tight">
      <div className="card-label" style={{ padding: '0 4px' }}>
        {title}
      </div>
      <div className="card tight">{children}</div>
    </section>
  )
}

function Row({ label, value, onClick }: { label: ReactNode; value: string; onClick: () => void }) {
  return (
    <button className="list-item" onClick={onClick}>
      <span style={{ flexShrink: 0 }}>{label}</span>
      <span className="grow muted truncate" style={{ textAlign: 'right' }}>
        {value}
      </span>
      <ChevronRight size={18} className="chev" />
    </button>
  )
}

function EditQuestion({ id, onClose }: { id: string; onClose: () => void }) {
  const { me, saveProfile } = useMe()
  const [profile, setProfile] = useState(me.profile)
  const action = useAction()
  const question = questionById(id)
  const valid = !question.valid || question.valid(profile)

  async function save() {
    if (await action.run(() => saveProfile(profile))) onClose()
  }

  return (
    <Sheet
      title={question.title}
      onClose={onClose}
      footer={
        <div className="stack tight">
          {changesPlan(me.profile, profile) && <p className="muted small">Dein Trainingsplan wird danach passend neu erstellt.</p>}
          <ErrorText>{action.error}</ErrorText>
          <button className="btn block" onClick={save} disabled={!valid || action.busy}>
            Speichern
          </button>
        </div>
      }
    >
      <div className="stack">
        {question.hint && <p className="muted small">{question.hint}</p>}
        {question.render(profile, (changes) => setProfile({ ...profile, ...changes }))}
      </div>
    </Sheet>
  )
}

function KcalSheet({ onClose }: { onClose: () => void }) {
  const { me, targets, saveProfile } = useMe()
  const calculated = calcTargets({ ...me.profile, kcalOverride: null }, weeklyLoad(me.plan))
  const [kcal, setKcal] = useState<number | null>(me.profile.kcalOverride ?? calculated.kcal)
  const action = useAction()

  async function save(override: number | null) {
    if (await action.run(() => saveProfile({ ...me.profile, kcalOverride: override }))) onClose()
  }

  const valid = kcal != null && kcal >= 1000 && kcal <= 6000

  return (
    <Sheet
      title="Kalorienziel"
      onClose={onClose}
      footer={
        <div className="stack tight">
          <ErrorText>{action.error}</ErrorText>
          <button className="btn block" disabled={!valid || action.busy} onClick={() => save(kcal === calculated.kcal ? null : kcal)}>
            Speichern
          </button>
          {me.profile.kcalOverride && (
            <button className="btn ghost block" onClick={() => save(null)} disabled={action.busy}>
              Berechneten Wert nutzen
            </button>
          )}
        </div>
      }
    >
      <div className="stack">
        <p className="muted small">
          Berechnet für dein Ziel: <strong>{formatNumber(calculated.kcal)} kcal</strong> (Gesamtverbrauch {formatNumber(targets.tdee)} kcal). Du kannst
          einen eigenen Wert festlegen, die Makros passen sich an.
        </p>
        <div className="number-input" style={{ padding: '8px 0' }}>
          <DecimalInput className="" inputMode="numeric" value={kcal} onChange={setKcal} aria-label="Kalorienziel in kcal" />
          <span className="unit">kcal</span>
        </div>
        {!valid && <p className="muted small">Bitte zwischen 1.000 und 6.000 kcal.</p>}
        {valid && kcal < calculated.bmr && <p className="error">Das liegt unter deinem Grundumsatz. Auf Dauer ist das nicht empfehlenswert.</p>}
      </div>
    </Sheet>
  )
}

function InstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Als App installieren" onClose={onClose}>
      <div className="stack">
        <p className="muted">Forma läuft im Browser, lässt sich aber wie eine echte App auf den Home-Bildschirm legen.</p>
        <div className="card stack">
          <strong>iPhone & iPad (Safari)</strong>
          <ol className="steps">
            <li>
              <span>
                Tippe unten auf <Share size={16} style={{ verticalAlign: -3 }} aria-label="Teilen" /> Teilen.
              </span>
            </li>
            <li>Scrolle runter und tippe auf „Zum Home-Bildschirm“.</li>
            <li>Tippe oben rechts auf „Hinzufügen“.</li>
          </ol>
        </div>
        <div className="card stack">
          <strong>Android (Chrome)</strong>
          <ol className="steps">
            <li>Tippe oben rechts auf das Menü ⋮.</li>
            <li>Tippe auf „App installieren“ oder „Zum Startbildschirm hinzufügen“.</li>
            <li>Bestätige mit „Installieren“.</li>
          </ol>
        </div>
      </div>
    </Sheet>
  )
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const action = useAction()

  async function save() {
    if (await action.run(() => api.put('/me/password', { current, next }))) onClose()
  }

  return (
    <Sheet
      title="Passwort ändern"
      onClose={onClose}
      footer={
        <div className="stack tight">
          <ErrorText>{action.error}</ErrorText>
          <button className="btn block" onClick={save} disabled={!current || next.length < 8 || action.busy}>
            Speichern
          </button>
        </div>
      }
    >
      <div className="stack">
        <input className="input" type="password" autoComplete="current-password" aria-label="Aktuelles Passwort" placeholder="Aktuelles Passwort" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <input className="input" type="password" autoComplete="new-password" aria-label="Neues Passwort" placeholder="Neues Passwort (mind. 8 Zeichen)" value={next} onChange={(e) => setNext(e.target.value)} />
        <p className="muted small">Danach wirst du auf allen anderen Geräten abgemeldet.</p>
      </div>
    </Sheet>
  )
}

function DeleteSheet({ onClose }: { onClose: () => void }) {
  const { refresh } = useMe()
  const [password, setPassword] = useState('')
  const action = useAction()

  async function remove() {
    const ok = await action.run(() => api.delete('/me', { password }))
    if (ok) {
      clearLocalData()
      await refresh()
    }
  }

  return (
    <Sheet
      title="Konto löschen"
      onClose={onClose}
      footer={
        <div className="stack tight">
          <ErrorText>{action.error}</ErrorText>
          <button className="btn danger block" onClick={remove} disabled={!password || action.busy}>
            Endgültig löschen
          </button>
        </div>
      }
    >
      <div className="stack">
        <p>Dein Konto und alle Daten (Plan, Trainings, Essen, Gewicht) werden endgültig gelöscht.</p>
        <input className="input" type="password" autoComplete="current-password" aria-label="Passwort zur Bestätigung" placeholder="Passwort zur Bestätigung" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
    </Sheet>
  )
}

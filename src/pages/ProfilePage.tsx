import { useState, type ReactNode } from 'react'
import { ChevronRight, Download, LogOut, Share, Sparkles } from 'lucide-react'
import { PageHeader, Sheet, formatNumber } from '../components/ui'
import { Segmented } from '../components/fields'
import { questionById } from '../components/questions'
import { AiSettingsSheet } from '../components/AiSettingsSheet'
import { cardioMinutes, clearLocalData, useMe, type Theme } from '../state/app'
import { api } from '../lib/api'
import { calcTargets, DIET_STYLES } from '../lib/nutrition'
import { ACTIVITY, CARDIO_LEVEL, EQUIPMENT_LABEL, EXPERIENCE, GOALS, SEX, WEEKDAYS_SHORT } from '../lib/labels'
import { findProvider } from '../lib/aiProviders'
import { loadAiSettings } from '../lib/ai'
import type { Profile } from '../lib/types'

// short text shown on the right side of each row
function summary(id: string, p: Profile): string {
  switch (id) {
    case 'sex': return SEX[p.sex]
    case 'age': return `${p.age} Jahre`
    case 'height': return `${p.heightCm} cm`
    case 'weight': return `${formatNumber(p.weightKg, 1)} kg`
    case 'activity': return ACTIVITY[p.activity].label
    case 'goal': return GOALS[p.goal].label
    case 'experience': return EXPERIENCE[p.experience].label
    case 'location': return p.location === 'gym' ? 'Fitnessstudio' : 'Zuhause'
    case 'equipment': return p.equipment.length ? p.equipment.map((e) => EQUIPMENT_LABEL[e]).join(', ') : 'Nichts'
    case 'days': return p.trainingDays.map((d) => WEEKDAYS_SHORT[d]).join(', ')
    case 'duration': return `${p.sessionMinutes} Min.`
    case 'cardio': return CARDIO_LEVEL[p.cardioLevel].label
    case 'diet': return DIET_STYLES[p.dietStyle].label
    default: return ''
  }
}

// short row labels (the questions themselves are too long for a settings row)
const LABELS: Record<string, string> = {
  sex: 'Geschlecht',
  age: 'Alter',
  height: 'Größe',
  weight: 'Gewicht',
  activity: 'Alltag',
  goal: 'Ziel',
  experience: 'Erfahrung',
  location: 'Trainingsort',
  equipment: 'Equipment',
  days: 'Trainingstage',
  duration: 'Dauer',
  cardio: 'Cardio',
  diet: 'Ernährungsstil',
}

const BODY = ['sex', 'age', 'height', 'weight', 'activity']
const TRAINING = ['goal', 'experience', 'location', 'equipment', 'days', 'duration', 'cardio']

export function ProfilePage() {
  const { me, targets, logout, saveSettings } = useMe()
  const [editing, setEditing] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'kcal' | 'ai' | 'install' | 'password' | 'delete' | null>(null)
  const ai = loadAiSettings()
  const p = me.profile

  const rows = (ids: string[]) =>
    ids
      .filter((id) => id !== 'equipment' || p.location === 'home')
      .map((id) => <Row key={id} label={LABELS[id]} value={summary(id, p)} onClick={() => setEditing(id)} />)

  return (
    <div className="page">
      <PageHeader title="Profil" eyebrow={me.email} />

      <Group title="Körper">{rows(BODY)}</Group>
      <Group title="Ziel & Training">{rows(TRAINING)}</Group>
      <Group title="Ernährung">
        <Row label={LABELS.diet} value={summary('diet', p)} onClick={() => setEditing('diet')} />
        <Row label="Kalorienziel" value={`${formatNumber(targets.kcal)} kcal${p.kcalOverride ? ' (eigenes)' : ''}`} onClick={() => setSheet('kcal')} />
      </Group>

      <Group title="KI-Modus">
        <Row
          label={
            <span className="row" style={{ gap: 6 }}>
              <Sparkles size={16} color="var(--accent)" /> KI-Anbieter
            </span>
          }
          value={ai?.apiKey || ai?.provider === 'custom' ? (findProvider(ai.provider)?.name ?? ai.provider) : 'Aus'}
          onClick={() => setSheet('ai')}
        />
      </Group>
      <p className="muted small" style={{ marginTop: -8, padding: '0 4px' }}>
        Ohne KI erkennt Forma Essen über eine eingebaute Tabelle und Open Food Facts. Mit eigenem API-Key schätzt eine KI Kalorien und Makros aus jedem Text.
      </p>

      <Group title="App">
        <div className="list-item" style={{ cursor: 'default' }}>
          <span className="grow">Darstellung</span>
          <div style={{ width: 200 }}>
            <Segmented<Theme>
              value={me.settings.theme ?? 'system'}
              onChange={(theme) => saveSettings({ ...me.settings, theme })}
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
        <a className="list-item" href="/api/export" download style={{ color: 'inherit' }}>
          <Download size={18} className="chev" />
          <span className="grow">Meine Daten exportieren</span>
        </a>
        <Row label="Passwort ändern" value="" onClick={() => setSheet('password')} />
        <button className="list-item" onClick={logout}>
          <LogOut size={18} className="chev" />
          <span className="grow">Abmelden</span>
        </button>
        <button className="list-item" onClick={() => setSheet('delete')} style={{ color: 'var(--bad)' }}>
          <span className="grow">Konto löschen</span>
        </button>
      </Group>

      {editing && <EditQuestion id={editing} onClose={() => setEditing(null)} />}
      {sheet === 'kcal' && <KcalSheet onClose={() => setSheet(null)} />}
      {sheet === 'ai' && <AiSettingsSheet onClose={() => setSheet(null)} />}
      {sheet === 'install' && <InstallSheet onClose={() => setSheet(null)} />}
      {sheet === 'password' && <PasswordSheet onClose={() => setSheet(null)} />}
      {sheet === 'delete' && <DeleteSheet onClose={() => setSheet(null)} />}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: 8 }}>
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
  const [busy, setBusy] = useState(false)
  const question = questionById(id)
  const valid = !question.valid || question.valid(profile)

  async function save() {
    setBusy(true)
    await saveProfile(profile)
    onClose()
  }

  return (
    <Sheet title={question.title} onClose={onClose}>
      <div className="stack">
        {question.hint && <p className="muted small">{question.hint}</p>}
        {question.render(profile, (changes) => setProfile({ ...profile, ...changes }))}
        {TRAINING.includes(id) && <p className="muted small">Dein Trainingsplan wird danach passend neu erstellt.</p>}
        <button className="btn block" onClick={save} disabled={!valid || busy}>
          Speichern
        </button>
      </div>
    </Sheet>
  )
}

function KcalSheet({ onClose }: { onClose: () => void }) {
  const { me, targets, saveProfile } = useMe()
  const calculated = calcTargets({ ...me.profile, kcalOverride: null }, cardioMinutes(me.plan))
  const [value, setValue] = useState(String(me.profile.kcalOverride ?? calculated.kcal))
  const kcal = Number(value)

  async function save(override: number | null) {
    await saveProfile({ ...me.profile, kcalOverride: override })
    onClose()
  }

  return (
    <Sheet title="Kalorienziel" onClose={onClose}>
      <div className="stack">
        <p className="muted small">
          Berechnet für dein Ziel: <strong>{formatNumber(calculated.kcal)} kcal</strong> (Gesamtverbrauch {formatNumber(targets.tdee)} kcal). Du kannst
          einen eigenen Wert festlegen, die Makros passen sich an.
        </p>
        <div className="number-input" style={{ padding: '8px 0' }}>
          <input type="number" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} aria-label="kcal" />
          <span className="unit">kcal</span>
        </div>
        {kcal > 0 && kcal < calculated.bmr && <p className="error">Das liegt unter deinem Grundumsatz. Auf Dauer ist das nicht empfehlenswert.</p>}
        <button className="btn block" disabled={!(kcal >= 1000 && kcal <= 6000)} onClick={() => save(kcal === calculated.kcal ? null : kcal)}>
          Speichern
        </button>
        {me.profile.kcalOverride && (
          <button className="btn ghost block" onClick={() => save(null)}>
            Berechneten Wert nutzen
          </button>
        )}
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
                Tippe unten auf <Share size={16} style={{ verticalAlign: -3 }} /> Teilen.
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
  const [message, setMessage] = useState('')

  async function save() {
    try {
      await api.put('/me/password', { current, next })
      onClose()
    } catch (err) {
      setMessage((err as Error).message)
    }
  }

  return (
    <Sheet title="Passwort ändern" onClose={onClose}>
      <div className="stack">
        <input className="input" type="password" autoComplete="current-password" placeholder="Aktuelles Passwort" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <input className="input" type="password" autoComplete="new-password" placeholder="Neues Passwort (mind. 8 Zeichen)" value={next} onChange={(e) => setNext(e.target.value)} />
        {message && <p className="error">{message}</p>}
        <button className="btn block" onClick={save} disabled={!current || next.length < 8}>
          Speichern
        </button>
      </div>
    </Sheet>
  )
}

function DeleteSheet({ onClose }: { onClose: () => void }) {
  const { refresh } = useMe()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function remove() {
    try {
      await api.delete('/me', { password })
      clearLocalData()
      await refresh()
    } catch (err) {
      setMessage((err as Error).message)
    }
  }

  return (
    <Sheet title="Konto löschen" onClose={onClose}>
      <div className="stack">
        <p>Dein Konto und alle Daten (Plan, Trainings, Essen, Gewicht) werden endgültig gelöscht.</p>
        <input className="input" type="password" autoComplete="current-password" placeholder="Passwort zur Bestätigung" value={password} onChange={(e) => setPassword(e.target.value)} />
        {message && <p className="error">{message}</p>}
        <button className="btn danger block" onClick={remove} disabled={!password}>
          Endgültig löschen
        </button>
      </div>
    </Sheet>
  )
}

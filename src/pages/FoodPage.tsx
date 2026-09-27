import { lazy, Suspense, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { ErrorText, MacroBar, PageHeader, Ring, Sheet, Spinner, Tip } from '../components/ui'
import { DecimalInput } from '../components/fields'
import { useMe } from '../state/app'
import { useAction, useFood } from '../lib/hooks'
import { api } from '../lib/api'
import { addDays, dayKey, formatDate, formatTime, startOfDay, toLocalInput } from '../lib/dates'
import { formatNumber } from '../lib/format'
import { sumMacros } from '../lib/nutrition'
import { tipFor } from '../lib/tips'
import type { FoodEntry } from '../lib/types'

// the food table is only loaded when you open the sheet
const FoodLogSheet = lazy(() => import('../components/FoodLogSheet').then((m) => ({ default: m.FoodLogSheet })))

const MEALS = [
  { label: 'Frühstück', until: 11 },
  { label: 'Mittagessen', until: 15 },
  { label: 'Snacks', until: 18 },
  { label: 'Abendessen', until: 24 },
]

function mealOf(entry: FoodEntry): string {
  const hour = new Date(entry.eatenAt).getHours()
  return MEALS.find((m) => hour < m.until)!.label
}

export function FoodPage() {
  const { me, targets } = useMe()
  const [date, setDate] = useState(() => startOfDay(new Date()))
  const food = useFood(date)
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<FoodEntry | null>(null)

  const total = sumMacros(food.data)
  const isToday = dayKey(date) === dayKey()

  return (
    <div className="page">
      <PageHeader title="Essen" />

      <div className="spread">
        <button className="icon-btn filled" onClick={() => setDate(addDays(date, -1))} aria-label="Vorheriger Tag">
          <ChevronLeft size={22} />
        </button>
        <strong>{isToday ? 'Heute' : formatDate(date)}</strong>
        <button className="icon-btn filled" onClick={() => setDate(addDays(date, 1))} disabled={isToday} aria-label="Nächster Tag">
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="card stack">
        <div className="nutrition-row">
          <Ring value={total.kcal} max={targets.kcal} size={112}>
            <span className="num" style={{ fontSize: 22, fontWeight: 750 }}>
              {formatNumber(total.kcal)}
            </span>
            <span className="muted tiny">von {formatNumber(targets.kcal)}</span>
          </Ring>
          <div className="macros">
            <MacroBar label="Eiweiß" value={total.protein} target={targets.protein} color="var(--protein)" />
            <MacroBar label="Kohlenhydrate" value={total.carbs} target={targets.carbs} color="var(--carbs)" />
            <MacroBar label="Fett" value={total.fat} target={targets.fat} color="var(--fat)" />
          </div>
        </div>
        <button className="btn block" onClick={() => setLogging(true)}>
          <Plus size={20} /> Essen tracken
        </button>
      </div>

      <ErrorText>{food.error}</ErrorText>
      {food.loading && food.data.length === 0 ? (
        <div className="empty">
          <Spinner />
        </div>
      ) : food.data.length === 0 ? (
        <p className="empty">Noch nichts eingetragen.</p>
      ) : (
        MEALS.map(({ label }) => {
          const entries = food.data.filter((e) => mealOf(e) === label)
          if (entries.length === 0) return null
          return (
            <section key={label} className="stack tight">
              <div className="spread" style={{ padding: '0 4px' }}>
                <span className="card-label">{label}</span>
                <span className="muted small num">{formatNumber(sumMacros(entries).kcal)} kcal</span>
              </div>
              <div className="card tight">
                {entries.map((entry) => (
                  <button key={entry.id} className="list-item" onClick={() => setEditing(entry)}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row tight">
                        <span className="truncate">{entry.name}</span>
                        {entry.source === 'ai' && <Sparkles size={13} color="var(--text-3)" aria-label="KI-Schätzung" />}
                      </div>
                      <div className="muted small truncate">
                        {formatTime(entry.eatenAt)}
                        {entry.amount && ` · ${entry.amount}`}
                      </div>
                    </div>
                    <span className="num strong">{formatNumber(entry.kcal)}</span>
                  </button>
                ))}
              </div>
            </section>
          )
        })
      )}

      <Tip>{tipFor(me.profile.goal, 'food', date)}</Tip>

      {logging && (
        <Suspense fallback={null}>
          <FoodLogSheet date={date} onClose={() => setLogging(false)} onSaved={food.reload} />
        </Suspense>
      )}
      {editing && <EditFood entry={editing} onClose={() => setEditing(null)} onSaved={food.reload} />}
    </div>
  )
}

function EditFood({ entry, onClose, onSaved }: { entry: FoodEntry; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ...entry, when: toLocalInput(new Date(entry.eatenAt)) })
  const action = useAction()

  async function save() {
    const eatenAt = new Date(form.when)
    if (Number.isNaN(eatenAt.getTime())) return action.setError('Bitte wähl einen Zeitpunkt.')
    const { when: _when, ...rest } = form
    if (await action.run(() => api.put(`/food/${entry.id}`, { ...rest, eatenAt: eatenAt.toISOString() }))) {
      onSaved()
      onClose()
    }
  }

  async function remove() {
    if (await action.run(() => api.delete(`/food/${entry.id}`))) {
      onSaved()
      onClose()
    }
  }

  return (
    <Sheet
      title="Eintrag bearbeiten"
      onClose={onClose}
      footer={
        <div className="stack tight">
          <ErrorText>{action.error}</ErrorText>
          <button className="btn block" onClick={save} disabled={action.busy}>
            Speichern
          </button>
          <button className="btn danger block" onClick={remove} disabled={action.busy}>
            Löschen
          </button>
        </div>
      }
    >
      <div className="stack">
        <label className="field">
          <span>Name</span>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Menge</span>
            <input className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
          <label className="field">
            <span>kcal</span>
            <DecimalInput value={form.kcal} onChange={(kcal) => setForm({ ...form, kcal: kcal ?? 0 })} />
          </label>
        </div>
        <div className="grid-3">
          {(['protein', 'carbs', 'fat'] as const).map((key) => (
            <label key={key} className="field">
              <span>{{ protein: 'Eiweiß', carbs: 'Kohlenh.', fat: 'Fett' }[key]} g</span>
              <DecimalInput value={form[key]} onChange={(value) => setForm({ ...form, [key]: value ?? 0 })} />
            </label>
          ))}
        </div>
        <label className="field">
          <span>Zeitpunkt</span>
          <input className="input" type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} />
        </label>
      </div>
    </Sheet>
  )
}

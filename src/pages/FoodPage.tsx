import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { MacroBar, PageHeader, Ring, Sheet, Spinner, Tip, formatNumber } from '../components/ui'
import { FoodLogSheet } from '../components/FoodLogSheet'
import { useMe } from '../state/app'
import { useFood } from '../lib/hooks'
import { api } from '../lib/api'
import { addDays, dayKey, formatDate, formatTime, startOfDay, toLocalInput } from '../lib/dates'
import { sumMacros } from '../lib/nutrition'
import { tipFor } from '../lib/tips'
import type { FoodEntry } from '../lib/types'

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
  const recent = useFood(addDays(startOfDay(new Date()), -14), 15)
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<FoodEntry | null>(null)

  const total = sumMacros(food.data)
  const isToday = dayKey(date) === dayKey()
  const reload = () => {
    food.reload()
    recent.reload()
  }

  return (
    <div className="page">
      <PageHeader title="Essen" />

      <div className="spread">
        <button className="icon-btn filled" onClick={() => setDate(addDays(date, -1))} aria-label="Vorheriger Tag">
          <ChevronLeft size={22} />
        </button>
        <strong>{isToday ? 'Heute' : formatDate(date)}</strong>
        <button className="icon-btn filled" onClick={() => setDate(addDays(date, 1))} disabled={isToday} aria-label="Nächster Tag" style={{ opacity: isToday ? 0.3 : 1 }}>
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="card stack">
        <div className="row" style={{ gap: 20 }}>
          <Ring value={total.kcal} max={targets.kcal} size={112}>
            <span className="num" style={{ fontSize: 22, fontWeight: 750 }}>
              {formatNumber(total.kcal)}
            </span>
            <span className="muted tiny">von {formatNumber(targets.kcal)}</span>
          </Ring>
          <div className="stack" style={{ flex: 1, gap: 10 }}>
            <MacroBar label="Eiweiß" value={total.protein} target={targets.protein} color="var(--protein)" />
            <MacroBar label="Kohlenhydrate" value={total.carbs} target={targets.carbs} color="var(--carbs)" />
            <MacroBar label="Fett" value={total.fat} target={targets.fat} color="var(--fat)" />
          </div>
        </div>
        <button className="btn block" onClick={() => setLogging(true)}>
          <Plus size={20} /> Essen tracken
        </button>
      </div>

      {food.loading ? (
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
            <section key={label} className="stack" style={{ gap: 8 }}>
              <div className="spread" style={{ padding: '0 4px' }}>
                <span className="card-label">{label}</span>
                <span className="muted small num">{formatNumber(sumMacros(entries).kcal)} kcal</span>
              </div>
              <div className="card tight">
                {entries.map((entry) => (
                  <button key={entry.id} className="list-item" onClick={() => setEditing(entry)}>
                    <div className="grow">
                      <div className="row" style={{ gap: 6 }}>
                        <span className="truncate">{entry.name}</span>
                        {entry.source === 'ai' && <Sparkles size={13} color="var(--text-3)" aria-label="KI-Schätzung" />}
                      </div>
                      <div className="muted small truncate">
                        {formatTime(entry.eatenAt)}
                        {entry.amount && ` · ${entry.amount}`}
                      </div>
                    </div>
                    <span className="num" style={{ fontWeight: 600 }}>
                      {formatNumber(entry.kcal)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )
        })
      )}

      <Tip>{tipFor(me.profile.goal, 'food', date)}</Tip>

      {logging && <FoodLogSheet date={date} onClose={() => setLogging(false)} onSaved={reload} recent={recent.data} />}
      {editing && <EditFood entry={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  )
}

function EditFood({ entry, onClose, onSaved }: { entry: FoodEntry; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ...entry, when: toLocalInput(new Date(entry.eatenAt)) })
  const [busy, setBusy] = useState(false)
  const num = (v: string) => Number(v.replace(',', '.')) || 0

  async function save() {
    setBusy(true)
    const { when, ...rest } = form
    await api.put(`/food/${entry.id}`, { ...rest, eatenAt: new Date(when).toISOString() })
    onSaved()
    onClose()
  }

  async function remove() {
    setBusy(true)
    await api.delete(`/food/${entry.id}`)
    onSaved()
    onClose()
  }

  return (
    <Sheet title="Eintrag bearbeiten" onClose={onClose}>
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
            <input className="input" inputMode="decimal" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: num(e.target.value) })} />
          </label>
        </div>
        <div className="grid-3">
          {(['protein', 'carbs', 'fat'] as const).map((key) => (
            <label key={key} className="field">
              <span>{{ protein: 'Eiweiß', carbs: 'Kohlenh.', fat: 'Fett' }[key]} g</span>
              <input className="input" inputMode="decimal" value={form[key]} onChange={(e) => setForm({ ...form, [key]: num(e.target.value) })} />
            </label>
          ))}
        </div>
        <label className="field">
          <span>Zeitpunkt</span>
          <input className="input" type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} />
        </label>
        <button className="btn block" onClick={save} disabled={busy}>
          Speichern
        </button>
        <button className="btn danger block" onClick={remove} disabled={busy}>
          Löschen
        </button>
      </div>
    </Sheet>
  )
}

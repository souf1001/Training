// "Essen tracken": describe (AI or built-in table), search products, or type values yourself.
import { useCallback, useMemo, useState } from 'react'
import { Mic, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { Sheet, Spinner, formatNumber } from './ui'
import { Segmented } from './fields'
import { api } from '../lib/api'
import { aiEnabled, estimateFood } from '../lib/ai'
import { macrosFor, parseFoodText, searchFoods } from '../lib/foodParser'
import { searchOpenFoodFacts, type OffProduct } from '../lib/openFoodFacts'
import { useSpeech } from '../lib/hooks'
import { sumMacros } from '../lib/nutrition'
import { toLocalInput } from '../lib/dates'
import type { FoodEntry, Macros } from '../lib/types'

interface Draft extends Macros {
  name: string
  amount: string
  source: FoodEntry['source']
  // when known, changing the grams recalculates the values
  per100?: Macros
  grams?: number
}

type Mode = 'describe' | 'search' | 'manual'

export function FoodLogSheet({ onClose, onSaved, date, recent = [] }: { onClose: () => void; onSaved: () => void; date?: Date; recent?: FoodEntry[] }) {
  const useAi = aiEnabled()
  const [mode, setMode] = useState<Mode>('describe')
  const [when, setWhen] = useState(() => {
    const now = new Date()
    const d = date ? new Date(date) : now
    d.setHours(now.getHours(), now.getMinutes())
    return toLocalInput(d)
  })
  const [items, setItems] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const total = sumMacros(items)

  const add = (draft: Draft) => setItems((list) => [...list, draft])
  const update = (index: number, changes: Partial<Draft>) =>
    setItems((list) =>
      list.map((item, i) => {
        if (i !== index) return item
        const next = { ...item, ...changes }
        if (changes.grams !== undefined && next.per100) Object.assign(next, macrosFor(next.per100, changes.grams), { amount: `${changes.grams} g` })
        return next
      }),
    )
  const remove = (index: number) => setItems((list) => list.filter((_, i) => i !== index))

  async function save() {
    setBusy(true)
    setError('')
    try {
      const eatenAt = new Date(when).toISOString()
      await api.post(
        '/food',
        items.map(({ per100: _per100, grams: _grams, ...item }) => ({ ...item, eatenAt })),
      )
      onSaved()
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  // recently eaten foods, one per name
  const recentUnique = useMemo(() => {
    const seen = new Set<string>()
    return [...recent].reverse().filter((f) => !seen.has(f.name) && seen.add(f.name)).slice(0, 8)
  }, [recent])

  return (
    <Sheet title="Essen tracken" onClose={onClose}>
      <div className="stack">
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'describe', label: 'Beschreiben' },
            { value: 'search', label: 'Suchen' },
            { value: 'manual', label: 'Manuell' },
          ]}
        />

        {mode === 'describe' && <Describe useAi={useAi} onItems={(list) => setItems((prev) => [...prev, ...list])} />}
        {mode === 'search' && <SearchFood onPick={add} />}
        {mode === 'manual' && <Manual onAdd={add} />}

        {items.length === 0 && recentUnique.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="card-label">Zuletzt gegessen</div>
            <div className="chips">
              {recentUnique.map((f) => (
                <button key={f.id} className="chip" style={{ border: 'none', cursor: 'pointer' }} onClick={() => add({ name: f.name, amount: f.amount, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, source: f.source })}>
                  <Plus size={14} /> {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="card-label">Wird gespeichert</div>
            <div className="card tight">
              {items.map((item, i) => (
                <ItemEditor key={i} item={item} onChange={(c) => update(i, c)} onRemove={() => remove(i)} />
              ))}
            </div>
            <div className="spread small muted num" style={{ padding: '0 4px' }}>
              <span>
                E {formatNumber(total.protein)} g · K {formatNumber(total.carbs)} g · F {formatNumber(total.fat)} g
              </span>
              <strong style={{ color: 'var(--text)' }}>{formatNumber(total.kcal)} kcal</strong>
            </div>
          </div>
        )}

        <label className="field">
          <span>Zeitpunkt</span>
          <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>

        {error && <p className="error">{error}</p>}
        <button className="btn block" disabled={items.length === 0 || busy} onClick={save}>
          {busy ? <Spinner /> : `Speichern${items.length ? ` · ${formatNumber(total.kcal)} kcal` : ''}`}
        </button>
      </div>
    </Sheet>
  )
}

function Describe({ useAi, onItems }: { useAi: boolean; onItems: (items: Draft[]) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const appendText = useCallback((spoken: string) => setText((t) => (t ? `${t}, ${spoken}` : spoken)), [])
  const speech = useSpeech(appendText)

  async function withAi() {
    setBusy(true)
    setMessage('')
    try {
      const items = await estimateFood(text)
      onItems(items.map((i) => ({ ...i, source: 'ai' as const })))
      setText('')
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function withTable() {
    const { items, unknown } = parseFoodText(text)
    onItems(items.map((i) => ({ ...i, source: 'db' as const })))
    setText(unknown.join(', '))
    setMessage(unknown.length ? `Nicht erkannt: ${unknown.join(', ')}. Probier „Suchen“ oder „Manuell“.` : '')
  }

  return (
    <div className="stack">
      <div style={{ position: 'relative' }}>
        <textarea
          className="textarea"
          placeholder={'Was hast du gegessen?\nz. B. 2 Eier, 2 Scheiben Vollkornbrot und ein Kaffee mit Milch'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ paddingRight: 56 }}
        />
        {speech.supported && (
          <button
            className={`icon-btn ${speech.listening ? 'accent' : 'filled'}`}
            style={{ position: 'absolute', right: 8, bottom: 12 }}
            onClick={speech.start}
            aria-label="Einsprechen"
            type="button"
          >
            <Mic size={20} />
          </button>
        )}
      </div>
      {!speech.supported && <p className="muted tiny">Tipp: Du kannst auch das Mikrofon deiner Tastatur zum Diktieren nutzen.</p>}
      {message && <p className="muted small">{message}</p>}
      {useAi ? (
        <div className="stack" style={{ gap: 4 }}>
          <button className="btn block" onClick={withAi} disabled={!text.trim() || busy}>
            {busy ? <Spinner /> : <><Sparkles size={18} /> Mit KI schätzen</>}
          </button>
          <button className="btn ghost block" onClick={withTable} disabled={!text.trim() || busy}>
            Ohne KI erkennen
          </button>
        </div>
      ) : (
        <button className="btn secondary block" onClick={withTable} disabled={!text.trim()}>
          Erkennen
        </button>
      )}
    </div>
  )
}

function SearchFood({ onPick }: { onPick: (draft: Draft) => void }) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<OffProduct[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const local = searchFoods(query)

  async function searchOnline() {
    setBusy(true)
    setMessage('')
    try {
      const result = await searchOpenFoodFacts(query)
      setProducts(result)
      if (result.length === 0) setMessage('Nichts gefunden.')
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function pick(name: string, per100: Macros, grams: number, source: Draft['source']) {
    onPick({ name, amount: `${grams} g`, ...macrosFor(per100, grams), per100, grams, source })
    setQuery('')
    setProducts([])
  }

  return (
    <div className="stack">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim()) searchOnline()
        }}
      >
        <input className="input" placeholder="Lebensmittel oder Marke" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="icon-btn filled" aria-label="Online suchen" disabled={!query.trim() || busy} style={{ height: 50, width: 50 }}>
          {busy ? <Spinner /> : <Search size={20} />}
        </button>
      </form>
      {(local.length > 0 || products.length > 0) && (
        <div className="card tight">
          {local.map((f) => (
            <button key={f.name} className="list-item" onClick={() => pick(f.name, f, f.unit?.grams ?? f.defaultGrams, 'db')}>
              <div className="grow">
                <div className="truncate">{f.name}</div>
                <div className="muted small">{f.kcal} kcal / 100 g</div>
              </div>
              <Plus size={18} className="chev" />
            </button>
          ))}
          {products.map((p, i) => (
            <button key={i} className="list-item" onClick={() => pick(p.brand ? `${p.name} (${p.brand})` : p.name, p, p.servingGrams ?? 100, 'off')}>
              <div className="grow">
                <div className="truncate">{p.name}</div>
                <div className="muted small truncate">
                  {p.brand && `${p.brand} · `}
                  {p.kcal} kcal / 100 g
                </div>
              </div>
              <Plus size={18} className="chev" />
            </button>
          ))}
        </div>
      )}
      {query.trim() && products.length === 0 && !busy && (
        <p className="muted small">{message || 'Enter oder Lupe drücken, um in Open Food Facts (Millionen Produkte) zu suchen.'}</p>
      )}
    </div>
  )
}

function Manual({ onAdd }: { onAdd: (draft: Draft) => void }) {
  const empty = { name: '', amount: '', kcal: '', protein: '', carbs: '', fat: '' }
  const [form, setForm] = useState(empty)
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })
  const num = (v: string) => Number(v.replace(',', '.')) || 0

  return (
    <div className="stack">
      <input className="input" placeholder="Name, z. B. Müsliriegel" value={form.name} onChange={set('name')} />
      <div className="grid-2">
        <input className="input" placeholder="Menge (optional)" value={form.amount} onChange={set('amount')} />
        <input className="input" placeholder="kcal" inputMode="decimal" value={form.kcal} onChange={set('kcal')} />
      </div>
      <div className="grid-3">
        <input className="input" placeholder="Eiweiß g" inputMode="decimal" value={form.protein} onChange={set('protein')} />
        <input className="input" placeholder="Kohlenh. g" inputMode="decimal" value={form.carbs} onChange={set('carbs')} />
        <input className="input" placeholder="Fett g" inputMode="decimal" value={form.fat} onChange={set('fat')} />
      </div>
      <button
        className="btn secondary block"
        disabled={!form.name || !form.kcal}
        onClick={() => {
          onAdd({ name: form.name, amount: form.amount, kcal: num(form.kcal), protein: num(form.protein), carbs: num(form.carbs), fat: num(form.fat), source: 'manual' })
          setForm(empty)
        }}
      >
        Hinzufügen
      </button>
    </div>
  )
}

function ItemEditor({ item, onChange, onRemove }: { item: Draft; onChange: (c: Partial<Draft>) => void; onRemove: () => void }) {
  const num = (v: string) => Number(v.replace(',', '.')) || 0
  return (
    <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default', gap: 8 }}>
      <div className="row">
        <input className="input" style={{ minHeight: 40, padding: '6px 10px', flex: 1 }} value={item.name} onChange={(e) => onChange({ name: e.target.value })} aria-label="Name" />
        <button className="icon-btn" onClick={onRemove} aria-label="Entfernen">
          <Trash2 size={18} color="var(--text-3)" />
        </button>
      </div>
      <div className="row small" style={{ gap: 6 }}>
        {item.per100 ? (
          <label className="row" style={{ gap: 4 }}>
            <input
              className="input num"
              style={{ minHeight: 36, width: 76, padding: '4px 8px' }}
              inputMode="numeric"
              value={item.grams ?? ''}
              onChange={(e) => onChange({ grams: num(e.target.value) })}
              aria-label="Gramm"
            />
            g
          </label>
        ) : (
          <span className="muted">{item.amount}</span>
        )}
        <span style={{ flex: 1 }} />
        <label className="row" style={{ gap: 4 }}>
          <input
            className="input num"
            style={{ minHeight: 36, width: 76, padding: '4px 8px' }}
            inputMode="numeric"
            value={item.kcal}
            onChange={(e) => onChange({ kcal: num(e.target.value), per100: undefined })}
            aria-label="kcal"
          />
          kcal
        </label>
      </div>
      <div className="muted tiny num">
        Eiweiß {formatNumber(item.protein, 1)} g · Kohlenhydrate {formatNumber(item.carbs, 1)} g · Fett {formatNumber(item.fat, 1)} g
      </div>
    </div>
  )
}

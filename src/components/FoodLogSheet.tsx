// "Essen tracken": describe (AI or built-in table), search products, or type values yourself.
import { useCallback, useMemo, useState } from 'react'
import { Mic, Plus, Repeat, Search, Sparkles, Trash2 } from 'lucide-react'
import { ErrorText, Sheet, Spinner } from './ui'
import { DecimalInput, Segmented } from './fields'
import { api } from '../lib/api'
import { aiEnabled, estimateFood } from '../lib/ai'
import { macrosFor, parseFoodText, searchFoods } from '../lib/foodParser'
import { searchOpenFoodFacts, type OffProduct } from '../lib/openFoodFacts'
import { useAction, useFood, useSpeech } from '../lib/hooks'
import { sumMacros } from '../lib/nutrition'
import { addDays, formatDate, startOfDay, toLocalInput } from '../lib/dates'
import { formatNumber } from '../lib/format'
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

const toDraft = (f: FoodEntry): Draft => ({ name: f.name, amount: f.amount, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, source: f.source })

export function FoodLogSheet({ onClose, onSaved, date }: { onClose: () => void; onSaved: () => void; date?: Date }) {
  const [mode, setMode] = useState<Mode>('describe')
  const [when, setWhen] = useState(() => {
    const now = new Date()
    const d = date ? new Date(date) : now
    d.setHours(now.getHours(), now.getMinutes())
    return toLocalInput(d)
  })
  const [items, setItems] = useState<Draft[]>([])
  const save = useAction()
  const recent = useFood(addDays(startOfDay(new Date()), -14), 15)
  const total = sumMacros(items)

  const add = (drafts: Draft[]) => setItems((list) => [...list, ...drafts])
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

  async function submit() {
    const eatenAt = new Date(when)
    if (Number.isNaN(eatenAt.getTime())) {
      save.setError('Bitte wähl einen Zeitpunkt.')
      return
    }
    const ok = await save.run(() =>
      api.post(
        '/food',
        items.map(({ per100: _per100, grams: _grams, ...item }) => ({ ...item, eatenAt: eatenAt.toISOString() })),
      ),
    )
    if (ok) {
      onSaved()
      onClose()
    }
  }

  // Meals eaten before: entries saved together share the same time.
  const { meals, singles } = useMemo(() => {
    const byTime = new Map<string, FoodEntry[]>()
    for (const f of recent.data) byTime.set(f.eatenAt, [...(byTime.get(f.eatenAt) ?? []), f])
    const meals = [...byTime.values()].filter((group) => group.length > 1).reverse().slice(0, 3)
    const seen = new Set<string>()
    const singles = [...recent.data].reverse().filter((f) => !seen.has(f.name) && seen.add(f.name)).slice(0, 8)
    return { meals, singles }
  }, [recent.data])

  return (
    <Sheet
      title="Essen tracken"
      onClose={onClose}
      footer={
        <div className="stack tight">
          <ErrorText>{save.error}</ErrorText>
          <button className="btn block" disabled={items.length === 0 || save.busy} onClick={submit}>
            {save.busy ? <Spinner /> : items.length ? `Speichern · ${formatNumber(total.kcal)} kcal` : 'Speichern'}
          </button>
        </div>
      }
    >
      <div className="stack">
        <Segmented<Mode>
          label="Art der Eingabe"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'describe', label: 'Beschreiben' },
            { value: 'search', label: 'Suchen' },
            { value: 'manual', label: 'Manuell' },
          ]}
        />

        {mode === 'describe' && <Describe onItems={add} />}
        {mode === 'search' && <SearchFood onPick={(d) => add([d])} />}
        {mode === 'manual' && <Manual onAdd={(d) => add([d])} />}

        {items.length === 0 && (meals.length > 0 || singles.length > 0) && (
          <div className="stack tight">
            <div className="card-label">Schnell wieder eintragen</div>
            {meals.map((meal) => (
              <button key={meal[0].eatenAt} className="option" style={{ padding: '10px 14px' }} onClick={() => add(meal.map(toDraft))}>
                <Repeat size={16} color="var(--text-3)" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="truncate small strong">{meal.map((f) => f.name).join(', ')}</div>
                  <div className="muted tiny">
                    Wie am {formatDate(meal[0].eatenAt, { weekday: 'long' })} · {formatNumber(sumMacros(meal).kcal)} kcal
                  </div>
                </div>
              </button>
            ))}
            <div className="chips">
              {singles.map((f) => (
                <button key={f.id} className="chip" style={{ border: 'none', cursor: 'pointer', minHeight: 32 }} onClick={() => add([toDraft(f)])}>
                  <Plus size={14} /> {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="stack tight">
            <div className="card-label">Wird gespeichert</div>
            <div className="card tight">
              {items.map((item, i) => (
                <ItemEditor key={i} item={item} onChange={(c) => update(i, c)} onRemove={() => remove(i)} />
              ))}
            </div>
            <div className="small muted num" style={{ padding: '0 4px' }}>
              Eiweiß {formatNumber(total.protein)} g · Kohlenh. {formatNumber(total.carbs)} g · Fett {formatNumber(total.fat)} g
            </div>
          </div>
        )}

        <label className="field">
          <span>Zeitpunkt</span>
          <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
      </div>
    </Sheet>
  )
}

function Describe({ onItems }: { onItems: (items: Draft[]) => void }) {
  const aiOn = aiEnabled()
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const ai = useAction()
  const appendText = useCallback((spoken: string) => setText((t) => (t ? `${t}, ${spoken}` : spoken)), [])
  const speech = useSpeech(appendText)

  async function withAi() {
    setMessage('')
    const ok = await ai.run(async () => {
      const items = await estimateFood(text)
      onItems(items.map((i) => ({ ...i, source: 'ai' as const })))
    })
    if (ok) setText('')
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
          aria-label="Was hast du gegessen?"
          placeholder={'Was hast du gegessen?\nz. B. 2 Eier, 2 Scheiben Vollkornbrot und ein Kaffee mit Milch'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) {
              if (aiOn) withAi()
              else withTable()
            }
          }}
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
      <ErrorText>{ai.error}</ErrorText>
      {aiOn ? (
        <div className="stack" style={{ gap: 4 }}>
          <button className="btn block" onClick={withAi} disabled={!text.trim() || ai.busy}>
            {ai.busy ? (
              <Spinner />
            ) : (
              <>
                <Sparkles size={18} /> Mit KI schätzen
              </>
            )}
          </button>
          <button className="btn ghost block" onClick={withTable} disabled={!text.trim() || ai.busy}>
            Ohne KI erkennen
          </button>
        </div>
      ) : (
        <button className="btn block" onClick={withTable} disabled={!text.trim()}>
          Erkennen
        </button>
      )}
    </div>
  )
}

function SearchFood({ onPick }: { onPick: (draft: Draft) => void }) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<OffProduct[]>([])
  const [searched, setSearched] = useState(false)
  const search = useAction()
  const local = searchFoods(query)

  async function searchOnline() {
    setSearched(false)
    await search.run(async () => setProducts(await searchOpenFoodFacts(query)))
    setSearched(true)
  }

  function pick(name: string, per100: Macros, grams: number, source: Draft['source']) {
    onPick({ name, amount: `${grams} g`, ...macrosFor(per100, grams), per100, grams, source })
    setQuery('')
    setProducts([])
    setSearched(false)
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
        <input className="input" aria-label="Lebensmittel oder Marke" placeholder="Lebensmittel oder Marke" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="icon-btn filled" aria-label="Online suchen" disabled={!query.trim() || search.busy} style={{ height: 50, width: 50 }}>
          {search.busy ? <Spinner /> : <Search size={20} />}
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
      <ErrorText>{search.error}</ErrorText>
      {query.trim() && products.length === 0 && !search.busy && !search.error && (
        <p className="muted small">{searched ? 'Nichts gefunden.' : 'Enter oder Lupe drücken, um in Open Food Facts (Millionen Produkte) zu suchen.'}</p>
      )}
    </div>
  )
}

interface ManualForm {
  name: string
  amount: string
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

function Manual({ onAdd }: { onAdd: (draft: Draft) => void }) {
  const empty: ManualForm = { name: '', amount: '', kcal: null, protein: null, carbs: null, fat: null }
  const [form, setForm] = useState(empty)

  return (
    <div className="stack">
      <input className="input" aria-label="Name" placeholder="Name, z. B. Müsliriegel" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="grid-2">
        <input className="input" aria-label="Menge" placeholder="Menge (optional)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <DecimalInput aria-label="kcal" placeholder="kcal" value={form.kcal} onChange={(kcal) => setForm({ ...form, kcal })} />
      </div>
      <div className="grid-3">
        <DecimalInput aria-label="Eiweiß in g" placeholder="Eiweiß g" value={form.protein} onChange={(protein) => setForm({ ...form, protein })} />
        <DecimalInput aria-label="Kohlenhydrate in g" placeholder="Kohlenh. g" value={form.carbs} onChange={(carbs) => setForm({ ...form, carbs })} />
        <DecimalInput aria-label="Fett in g" placeholder="Fett g" value={form.fat} onChange={(fat) => setForm({ ...form, fat })} />
      </div>
      <button
        className="btn secondary block"
        disabled={!form.name || form.kcal == null}
        onClick={() => {
          onAdd({ name: form.name, amount: form.amount, kcal: form.kcal ?? 0, protein: form.protein ?? 0, carbs: form.carbs ?? 0, fat: form.fat ?? 0, source: 'manual' })
          setForm(empty)
        }}
      >
        Hinzufügen
      </button>
    </div>
  )
}

function ItemEditor({ item, onChange, onRemove }: { item: Draft; onChange: (c: Partial<Draft>) => void; onRemove: () => void }) {
  return (
    <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div className="row">
        <input className="input compact" style={{ flex: 1 }} value={item.name} onChange={(e) => onChange({ name: e.target.value })} aria-label="Name" />
        <button className="icon-btn" onClick={onRemove} aria-label={`${item.name} entfernen`}>
          <Trash2 size={18} color="var(--text-3)" />
        </button>
      </div>
      <div className="row small" style={{ gap: 6 }}>
        {item.per100 ? (
          <label className="row" style={{ gap: 4 }}>
            <DecimalInput
              className="input compact num"
              style={{ width: 76 }}
              inputMode="numeric"
              value={item.grams ?? null}
              onChange={(grams) => onChange({ grams: grams ?? 0 })}
              aria-label="Gramm"
            />
            g
          </label>
        ) : (
          <span className="muted">{item.amount}</span>
        )}
        <span style={{ flex: 1 }} />
        <label className="row" style={{ gap: 4 }}>
          <DecimalInput
            className="input compact num"
            style={{ width: 76 }}
            value={item.kcal}
            onChange={(kcal) => onChange({ kcal: kcal ?? 0, per100: undefined })}
            aria-label="kcal"
          />
          kcal
        </label>
      </div>
      <div className="muted tiny num">
        Eiweiß {formatNumber(item.protein, 1)} g · Kohlenh. {formatNumber(item.carbs, 1)} g · Fett {formatNumber(item.fat, 1)} g
      </div>
    </div>
  )
}

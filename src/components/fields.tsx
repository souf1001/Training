// Inputs used in the questionnaire, the settings and the logging screens.
import { useState, type InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { WEEKDAYS_SHORT } from '../lib/labels'
import { parseDecimal } from '../lib/format'

interface Option<T> {
  value: T
  label: string
  text?: string
  badge?: string
}

export function OptionList<T extends string>({ options, value, onChange, label }: { options: Option<T>[]; value: T | null; onChange: (value: T) => void; label?: string }) {
  return (
    <div className="options" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`option ${value === o.value ? 'selected' : ''}`}
          onClick={() => onChange(o.value)}
        >
          <div className="grow">
            <div className="row tight">
              <span className="option-title">{o.label}</span>
              {o.badge && <span className="chip accent">{o.badge}</span>}
            </div>
            {o.text && <div className="option-text">{o.text}</div>}
          </div>
          <span className="check">{value === o.value && <Check size={14} strokeWidth={3} />}</span>
        </button>
      ))}
    </div>
  )
}

export function MultiOptionList<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T[]; onChange: (value: T[]) => void }) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <div className="options">
      {options.map((o) => {
        const selected = value.includes(o.value)
        return (
          <button key={o.value} type="button" aria-pressed={selected} className={`option multi ${selected ? 'selected' : ''}`} onClick={() => toggle(o.value)}>
            <div className="grow">
              <div className="option-title">{o.label}</div>
              {o.text && <div className="option-text">{o.text}</div>}
            </div>
            <span className="check">{selected && <Check size={14} strokeWidth={3} />}</span>
          </button>
        )
      })}
    </div>
  )
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))
  return (
    <div className="weekdays">
      {WEEKDAYS_SHORT.map((label, day) => (
        <button key={day} type="button" className={`weekday ${value.includes(day) ? 'selected' : ''}`} onClick={() => toggle(day)} aria-pressed={value.includes(day)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; label?: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const toText = (value: number | null) => (value == null ? '' : String(value).replace('.', ','))

// Number field that accepts "72,5" and "72.5". It keeps what you typed (e.g. "72,")
// and reports the number (or null when empty) to the parent.
export function DecimalInput({
  value,
  onChange,
  className = 'input',
  ...rest
}: { value: number | null; onChange: (value: number | null) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(toText(value))
  // the value was changed from outside (e.g. prefilled): show it
  if (parseDecimal(text) !== value && !(text === '' && value == null)) setText(toText(value))
  return (
    <input
      {...rest}
      className={className}
      type="text"
      inputMode={rest.inputMode ?? 'decimal'}
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d.,]/g, '')
        setText(next)
        onChange(parseDecimal(next))
      }}
    />
  )
}

// Large number with unit, used for age, height and weight in the questionnaire.
export function BigNumber({ value, onChange, unit, label, min, max, decimals = false }: { value: number; onChange: (n: number) => void; unit: string; label: string; min: number; max: number; decimals?: boolean }) {
  const valid = Number.isFinite(value) && value >= min && value <= max
  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <div className="number-input">
        <DecimalInput
          className=""
          value={Number.isFinite(value) ? value : null}
          onChange={(n) => onChange(n ?? NaN)}
          inputMode={decimals ? 'decimal' : 'numeric'}
          aria-label={label}
          autoFocus
          onFocus={(e) => e.target.select()}
        />
        <span className="unit">{unit}</span>
      </div>
      {!valid && (
        <p className="muted small">
          Bitte zwischen {min} und {max} {unit}
        </p>
      )}
    </div>
  )
}

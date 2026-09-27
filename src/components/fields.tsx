// Inputs used in the questionnaire and in the settings.
import { Check } from 'lucide-react'
import { WEEKDAYS_SHORT } from '../lib/labels'

interface Option<T> {
  value: T
  label: string
  text?: string
  badge?: string
}

export function OptionList<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T | null; onChange: (value: T) => void }) {
  return (
    <div className="options">
      {options.map((o) => (
        <button key={o.value} type="button" className={`option ${value === o.value ? 'selected' : ''}`} onClick={() => onChange(o.value)}>
          <div className="grow">
            <div className="row" style={{ gap: 8 }}>
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
          <button key={o.value} type="button" className={`option multi ${selected ? 'selected' : ''}`} onClick={() => toggle(o.value)}>
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

export function Segmented<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Large number with unit, used for age, height and weight.
export function BigNumber({ value, onChange, unit, min, max, step = 1 }: { value: number; onChange: (n: number) => void; unit: string; min: number; max: number; step?: number }) {
  return (
    <div className="number-input">
      <input
        type="number"
        inputMode={step < 1 ? 'decimal' : 'numeric'}
        value={Number.isNaN(value) ? '' : value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value.replace(',', '.')))}
        aria-label={unit}
      />
      <span className="unit">{unit}</span>
    </div>
  )
}

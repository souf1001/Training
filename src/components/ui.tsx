// Small building blocks used on every page.
import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Lightbulb, X } from 'lucide-react'

export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="title">{title}</h1>
      </div>
      {action}
    </header>
  )
}

export function BackBar({ to, action }: { to?: string; action?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="top-bar">
      <button className="icon-btn" onClick={() => (to ? navigate(to) : navigate(-1))} aria-label="Zurück">
        <ChevronLeft size={26} />
      </button>
      {action}
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Escape closes the sheet, and the page behind it must not scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-btn filled" onClick={onClose} aria-label="Schließen" style={{ width: 32, height: 32, borderRadius: 16 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="tip">
      <Lightbulb size={18} />
      <div>{children}</div>
    </div>
  )
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Lädt" />
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="progress">
      <div style={{ width: `${percent}%`, background: color }} />
    </div>
  )
}

export function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div className="macro">
      <div className="spread">
        <span>{label}</span>
        <span className="num muted">
          <strong style={{ color: 'var(--text)' }}>{Math.round(value)}</strong> / {target} g
        </span>
      </div>
      <ProgressBar value={value} max={target} color={color} />
    </div>
  )
}

// Circular progress, e.g. calories eaten of the daily goal.
export function Ring({ value, max, size = 128, children }: { value: number; max: number; size?: number; children?: ReactNode }) {
  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const percent = max > 0 ? Math.min(1, value / max) : 0
  const over = value > max

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? 'var(--bad)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent)}
          style={{ transition: 'stroke-dashoffset 0.5s' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits })
}

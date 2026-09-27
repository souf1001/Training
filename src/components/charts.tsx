// Two small SVG charts without a chart library.
// Tap or hover a point/bar to see its value.
import { useState, type PointerEvent } from 'react'

const WIDTH = 320
const PAD = { top: 16, right: 8, bottom: 22, left: 34 }

interface Point {
  label: string // x axis label, e.g. "12.09."
  value: number
  trend?: number // optional smoothed value (e.g. 7-day average), drawn as the line
}

function niceRange(values: number[], padding: number): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  return [Math.floor(min - padding), Math.ceil(max + padding)]
}

// Which item is under the pointer. `toIndex` turns an x position (in SVG units) into an index.
function useHover(count: number, toIndex: (x: number) => number) {
  const [index, setIndex] = useState<number | null>(null)
  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH
    setIndex(Math.min(count - 1, Math.max(0, toIndex(x))))
  }
  return {
    index,
    handlers: { onPointerMove: onPointer, onPointerDown: onPointer, onPointerLeave: () => setIndex(null) },
  }
}

export function LineChart({ points, unit, height = 160 }: { points: Point[]; unit: string; height?: number }) {
  const values = points.flatMap((p) => (p.trend != null ? [p.value, p.trend] : [p.value]))
  const hasTrend = points.some((p) => p.trend != null)
  const [min, max] = niceRange(values, 0.5)
  const innerW = WIDTH - PAD.left - PAD.right
  const hover = useHover(points.length, (px) => Math.round(((px - PAD.left) / innerW) * (points.length - 1)))
  const innerH = height - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min || 1)) * innerH
  // with a trend, the line shows the average and the single measurements are small dots
  const lineValue = (p: Point) => (hasTrend ? (p.trend ?? p.value) : p.value)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(lineValue(p))}`).join(' ')
  const active = hover.index != null ? points[hover.index] : null
  const firstLabel = points[0]?.label
  const lastLabel = points[points.length - 1]?.label

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} {...hover.handlers} role="img" aria-label="Gewichtsverlauf">
        {[min, (min + max) / 2, max].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="axis">
              {Math.round(v)}
            </text>
          </g>
        ))}
        <text x={x(0)} y={height - 4} className="axis" textAnchor="start">
          {firstLabel}
        </text>
        {points.length > 1 && (
          <text x={x(points.length - 1)} y={height - 4} className="axis" textAnchor="end">
            {lastLabel}
          </text>
        )}
        {hasTrend && points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} fill="var(--text-3)" opacity={0.6} />)}
        <path d={path} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover.index != null && (
          <>
            <line x1={x(hover.index)} x2={x(hover.index)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--text-3)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover.index)} cy={y(points[hover.index].value)} r={5} fill="var(--chart)" stroke="var(--card)" strokeWidth={2} />
          </>
        )}
        {hover.index == null && points.length > 0 && (
          <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].value)} r={4} fill="var(--chart)" stroke="var(--card)" strokeWidth={2} />
        )}
      </svg>
      {active && (
        <div className="chart-tooltip" style={{ left: `${(x(hover.index!) / WIDTH) * 100}%` }}>
          {active.label}: {active.value.toLocaleString('de-DE')} {unit}
          {active.trend != null && ` · Ø ${active.trend.toLocaleString('de-DE', { maximumFractionDigits: 1 })}`}
        </div>
      )}
    </div>
  )
}

export function BarChart({ points, target, unit, height = 160 }: { points: Point[]; target: number; unit: string; height?: number }) {
  const max = Math.max(target * 1.2, ...points.map((p) => p.value))
  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const slot = innerW / points.length
  const hover = useHover(points.length, (px) => Math.floor((px - PAD.left) / slot))
  const barW = Math.min(28, slot - 8)
  const y = (v: number) => PAD.top + (1 - v / max) * innerH
  const center = (i: number) => PAD.left + slot * i + slot / 2
  const active = hover.index != null ? points[hover.index] : null

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} {...hover.handlers} role="img" aria-label="Kalorien pro Tag">
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--line)" />
        {points.map((p, i) => {
          const h = Math.max(0, y(0) - y(p.value))
          const r = Math.min(4, h / 2, barW / 2)
          const left = center(i) - barW / 2
          const top = y(p.value)
          // bar with rounded top corners, flat on the baseline
          const d = h > 0 ? `M${left},${y(0)} V${top + r} Q${left},${top} ${left + r},${top} H${left + barW - r} Q${left + barW},${top} ${left + barW},${top + r} V${y(0)} Z` : ''
          return (
            <g key={i}>
              {d && <path d={d} fill="var(--chart)" opacity={hover.index == null || hover.index === i ? 1 : 0.45} />}
              <text x={center(i)} y={height - 4} textAnchor="middle" className="axis">
                {p.label}
              </text>
            </g>
          )
        })}
        {/* the daily goal as reference line */}
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--text-2)" strokeWidth={1} strokeDasharray="4 4" />
        <text x={PAD.left - 6} y={y(target) + 4} textAnchor="end" className="axis">
          Ziel
        </text>
      </svg>
      {active && (
        <div className="chart-tooltip" style={{ left: `${(center(hover.index!) / WIDTH) * 100}%` }}>
          {active.label}: {Math.round(active.value).toLocaleString('de-DE')} {unit}
        </div>
      )}
    </div>
  )
}

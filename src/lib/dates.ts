// Date helpers. We always work with the user's local time.

// "2026-09-27" in local time (toISOString would use UTC and can be off by a day)
export function dayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Monday = 0 ... Sunday = 6
export function weekdayIndex(date = new Date()): number {
  return (date.getDay() + 6) % 7
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

// value for <input type="datetime-local">
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDate(date: Date | string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  // "2026-09-27" alone would be read as UTC midnight, so we add a local time
  const value = typeof date === 'string' && date.length === 10 ? `${date}T12:00` : date
  return new Date(value).toLocaleDateString('de-DE', options)
}

export function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

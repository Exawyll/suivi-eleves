function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** French day label ("Aujourd'hui", "Hier", or "18 mars" / "18 mars 2025" across years), based on local calendar days. */
export function toDateLabel(date: Date, now: Date = new Date()): string {
  if (isSameCalendarDay(date, now)) return "Aujourd'hui"
  if (isSameCalendarDay(date, addDays(now, -1))) return 'Hier'

  const withYear = date.getFullYear() !== now.getFullYear()
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: withYear ? 'numeric' : undefined,
  }).format(date)
}

/** 24h "HH:MM" time label. */
export function toTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

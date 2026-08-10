import { APP_TIMEZONE } from './constants'

const dateKeyFormatterCache = new Map<string, Intl.DateTimeFormat>()

function dateKeyFormatter(timezone: string) {
  let formatter = dateKeyFormatterCache.get(timezone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    dateKeyFormatterCache.set(timezone, formatter)
  }
  return formatter
}

export function toDateKey(value: Date | string, timezone = APP_TIMEZONE): string {
  return dateKeyFormatter(timezone).format(typeof value === 'string' ? new Date(value) : value)
}

export function todayKey(timezone = APP_TIMEZONE): string {
  return toDateKey(new Date(), timezone)
}

export function shiftDateKey(key: string, amount: number): string {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function recentDateKeys(days: number, endKey = todayKey()): string[] {
  return Array.from({ length: days }, (_, index) => shiftDateKey(endKey, index - days + 1))
}

export function formatDayHeading(key: string, endKey = todayKey()): string {
  if (key === endKey) return 'Today'
  if (key === shiftDateKey(endKey, -1)) return 'Yesterday'
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' }).format(
    new Date(`${key}T12:00:00Z`),
  )
}

export function formatShortDay(key: string): string {
  return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(`${key}T12:00:00Z`))
}

export function formatMealTime(iso: string, timezone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatLongDate(key: string): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${key}T12:00:00Z`))
}

export function toLocalDateTimeInput(iso = new Date().toISOString()): string {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

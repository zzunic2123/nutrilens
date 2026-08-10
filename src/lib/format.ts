export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits }).format(value)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there'
}

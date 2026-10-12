const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatUsd(value: number): string {
  return usd.format(value)
}

export function formatPct(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`
}

const compactUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })

// Axis-tick form: $0, $500, -$1.5K.
export function formatUsdCompact(value: number): string {
  return compactUsd.format(value)
}

// "2026-10-07" -> "10/7".
export function formatDay(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

// 45_000 -> "45s", 192_000 -> "3m 12s", 7_041_000 -> "1h 57m".
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

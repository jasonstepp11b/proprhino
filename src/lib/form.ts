// Helpers for reading typed values out of submitted FormData.

export function text(data: FormData, name: string): string {
  return String(data.get(name) ?? '').trim()
}

export function number(data: FormData, name: string): number {
  return Number(text(data, name))
}

// Blank inputs become null rather than 0.
export function optionalNumber(data: FormData, name: string): number | null {
  const value = text(data, name)
  return value === '' ? null : Number(value)
}

// Today's date in local time as YYYY-MM-DD, for date input defaults.
export function today(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

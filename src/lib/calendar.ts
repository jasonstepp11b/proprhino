// Month-grid helpers for the P&L calendar. Months are "YYYY-MM" and days are
// "YYYY-MM-DD", matching trade_date; all arithmetic is in UTC so the local
// time zone never shifts a date.

const pad = (value: number) => String(value).padStart(2, '0')

export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, index - 1 + delta, 1))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// Weeks of the month, Monday first. Each week has one slot per weekday shown
// (5, or 7 with weekends); slots outside the month are null. Weeks with no
// visible day are dropped.
export function monthWeeks(month: string, includeWeekends: boolean): (string | null)[][] {
  const [year, index] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, index, 0)).getUTCDate()
  const offset = (new Date(Date.UTC(year, index - 1, 1)).getUTCDay() + 6) % 7
  const slots: (string | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, day) => `${month}-${pad(day + 1)}`)]
  const weeks: (string | null)[][] = []
  for (let start = 0; start < slots.length; start += 7) {
    const week = [...slots.slice(start, start + 7), ...Array<null>(7).fill(null)].slice(0, includeWeekends ? 7 : 5)
    if (week.some((day) => day !== null)) weeks.push(week)
  }
  return weeks
}

// True for Saturday or Sunday.
export function isWeekend(day: string): boolean {
  return new Date(`${day}T00:00:00Z`).getUTCDay() % 6 === 0
}

import { isMicro } from '@/lib/instruments'
import type { CommissionRates, CsvRow, ParsedTrade, ParseResult } from './types'
import type { Platform } from '@/types/domain'

// "$1,234.50", "-$12.50", "($12.50)" and "$(12.50)" all appear in exports.
export function parseMoney(raw: string | undefined): number {
  const text = (raw ?? '').trim()
  const value = Number(text.replace(/[$,()\s]/g, ''))
  if (text === '' || Number.isNaN(value)) throw new Error(`Invalid amount "${raw ?? ''}"`)
  return text.includes('(') ? -Math.abs(value) : value
}

export function parseNumber(raw: string | undefined, field: string): number {
  const value = Number((raw ?? '').replace(/,/g, '').trim())
  if ((raw ?? '').trim() === '' || Number.isNaN(value)) throw new Error(`Invalid ${field} "${raw ?? ''}"`)
  return value
}

const US_DATETIME = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i

// Exports carry US-style local timestamps with no zone ("12/01/2025 09:31:05",
// "12/1/2025 9:31:05 AM"); they are read in the browser's time zone, which
// matches the export as long as it was downloaded on the same machine.
export function parseUsDateTime(raw: string | undefined): Date {
  const match = (raw ?? '').trim().match(US_DATETIME)
  if (!match) throw new Error(`Invalid timestamp "${raw ?? ''}"`)
  const [, month, day, year, hourText, minute, second, meridiem] = match
  let hour = Number(hourText)
  if (meridiem) hour = (hour % 12) + (meridiem.toUpperCase() === 'PM' ? 12 : 0)
  return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second ?? 0))
}

const EASTERN_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  hourCycle: 'h23',
})
const SESSION_ROLLOVER_HOUR_ET = 18

// Trading day the exit belongs to. Futures sessions roll at 6pm ET, so an
// exit at or after 18:00 ET (including Sunday evening) counts toward the next
// calendar date, which is how prop firms count days.
export function toTradeDate(date: Date): string {
  const parts = Object.fromEntries(EASTERN_PARTS.formatToParts(date).map((part) => [part.type, Number(part.value)]))
  const rollover = parts.hour >= SESSION_ROLLOVER_HOUR_ET ? 1 : 0
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + rollover)).toISOString().slice(0, 10)
}

// Runs `parseRow` over every row, collecting failures instead of aborting.
// Identical keys within one file get an occurrence suffix so genuinely
// duplicated fills survive while a re-import still dedupes.
export function parseRows(platform: Platform, rows: CsvRow[], parseRow: (row: CsvRow) => ParsedTrade): ParseResult {
  const result: ParseResult = { platform, trades: [], errors: [] }
  const seen = new Map<string, number>()
  rows.forEach((row, index) => {
    try {
      const trade = parseRow(row)
      const occurrence = seen.get(trade.dedupe_key) ?? 0
      seen.set(trade.dedupe_key, occurrence + 1)
      result.trades.push({ ...trade, dedupe_key: `${trade.dedupe_key}#${occurrence}` })
    } catch (error) {
      result.errors.push({ row: index + 1, message: error instanceof Error ? error.message : String(error) })
    }
  })
  return result
}

const toCents = (value: number) => Math.round(value * 100) / 100

// For exports that carry no fees: charges the account's per-contract rate and
// recomputes net P&L from gross.
export function applyCommissions(trades: ParsedTrade[], rates: CommissionRates): ParsedTrade[] {
  return trades.map((trade) => {
    const commission = toCents(trade.quantity * (isMicro(trade.symbol) ? rates.micro : rates.standard))
    return { ...trade, commission, net_pnl: toCents(trade.gross_pnl - commission) }
  })
}

import type { Trade } from '@/types/domain'

type BreakdownTrade = Pick<Trade, 'entry_time' | 'exit_time' | 'trade_date' | 'net_pnl'>

export interface Bucket {
  name: string
  trades: number
  // Null never occurs for a returned bucket; empty buckets are dropped.
  winRatePct: number
  netPnl: number
  avgPnl: number
}

// Groups trades by `indexOf` into the named buckets, keeping bucket order and
// dropping empty ones.
function bucketize(trades: BreakdownTrade[], names: string[], indexOf: (trade: BreakdownTrade) => number): Bucket[] {
  const groups = names.map(() => [] as number[])
  for (const trade of trades) groups[indexOf(trade)]?.push(trade.net_pnl)
  return groups.flatMap((pnls, index) => {
    if (pnls.length === 0) return []
    const netPnl = pnls.reduce((total, pnl) => total + pnl, 0)
    return [{ name: names[index], trades: pnls.length, winRatePct: (pnls.filter((pnl) => pnl > 0).length / pnls.length) * 100, netPnl, avgPnl: netPnl / pnls.length }]
  })
}

const MINUTE = 60_000
const HOLD_BUCKETS: { name: string; under: number }[] = [
  { name: 'Under 1 min', under: MINUTE },
  { name: '1–5 min', under: 5 * MINUTE },
  { name: '5–15 min', under: 15 * MINUTE },
  { name: '15–60 min', under: 60 * MINUTE },
  { name: 'Over 1 hour', under: Infinity },
]

export const holdMs = (trade: Pick<Trade, 'entry_time' | 'exit_time'>) => new Date(trade.exit_time).getTime() - new Date(trade.entry_time).getTime()

export function byHoldTime(trades: BreakdownTrade[]): Bucket[] {
  return bucketize(
    trades,
    HOLD_BUCKETS.map((bucket) => bucket.name),
    (trade) => HOLD_BUCKETS.findIndex((bucket) => holdMs(trade) < bucket.under),
  )
}

export interface HoldAverages {
  winners: number | null
  losers: number | null
}

// Mean hold in milliseconds for winning and losing trades.
export function averageHold(trades: BreakdownTrade[]): HoldAverages {
  const mean = (subset: BreakdownTrade[]) => (subset.length ? subset.reduce((total, trade) => total + holdMs(trade), 0) / subset.length : null)
  return { winners: mean(trades.filter((trade) => trade.net_pnl > 0)), losers: mean(trades.filter((trade) => trade.net_pnl < 0)) }
}

const EASTERN_HOUR = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' })
const SESSION_OPEN_HOUR_ET = 18

function hourLabel(hour: number): string {
  return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`
}

// By the Eastern-time hour the trade was entered, listed in session order
// starting from the 6 PM open.
export function byEntryHour(trades: BreakdownTrade[]): Bucket[] {
  const hours = Array.from({ length: 24 }, (_, offset) => (SESSION_OPEN_HOUR_ET + offset) % 24)
  return bucketize(trades, hours.map(hourLabel), (trade) => hours.indexOf(Number(EASTERN_HOUR.format(new Date(trade.entry_time))) % 24))
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// By the weekday of the trading day, so Sunday-evening trades count as Monday.
export function byWeekday(trades: BreakdownTrade[]): Bucket[] {
  return bucketize(trades, WEEKDAYS, (trade) => (new Date(`${trade.trade_date}T00:00:00Z`).getUTCDay() + 6) % 7)
}

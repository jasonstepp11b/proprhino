import type { Trade } from '@/types/domain'

type DailyTrade = Pick<Trade, 'trade_date' | 'net_pnl'>

export function dailyNetPnl(trades: DailyTrade[]): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const trade of trades) {
    byDay.set(trade.trade_date, (byDay.get(trade.trade_date) ?? 0) + trade.net_pnl)
  }
  return byDay
}

export interface ConsistencyStatus {
  totalProfit: number
  bestDayProfit: number
  // Best day as a share of total profit; null until the account is net positive.
  bestDayPct: number | null
  limitPct: number
  compliant: boolean
  // Extra profit that brings the best day within the limit, assuming no
  // later day beats it. Zero when already compliant.
  profitNeeded: number
}

// Consistency rule: the single best day may not exceed `limitPct` of total
// profit (e.g. 30). An account with no net profit has nothing to pay out, so
// it is reported as non-compliant with a null percentage.
export function checkConsistency(trades: DailyTrade[], limitPct: number): ConsistencyStatus {
  const days = [...dailyNetPnl(trades).values()]
  const totalProfit = days.reduce((total, pnl) => total + pnl, 0)
  const bestDayProfit = Math.max(0, ...days)
  const bestDayPct = totalProfit > 0 ? (bestDayProfit / totalProfit) * 100 : null
  return {
    totalProfit,
    bestDayProfit,
    bestDayPct,
    limitPct,
    compliant: bestDayPct !== null && bestDayPct <= limitPct,
    profitNeeded: Math.max(0, (bestDayProfit * 100) / limitPct - totalProfit),
  }
}

export interface TradingDaysStatus {
  completed: number
  required: number
  remaining: number
}

export function checkTradingDays(trades: DailyTrade[], required: number): TradingDaysStatus {
  const completed = dailyNetPnl(trades).size
  return { completed, required, remaining: Math.max(0, required - completed) }
}

// Rules are judged per payout cycle: only trading days after the most recent
// payout count. Returns that payout's date, or null if there has been none.
export function cycleStart(payoutDates: string[]): string | null {
  return payoutDates.length ? payoutDates.reduce((latest, date) => (date > latest ? date : latest)) : null
}

export function tradesInCycle<T extends DailyTrade>(trades: T[], start: string | null): T[] {
  return start === null ? trades : trades.filter((trade) => trade.trade_date > start)
}

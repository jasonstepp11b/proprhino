import { dailyNetPnl } from '@/lib/rules'
import type { Trade } from '@/types/domain'

type PerformanceTrade = Pick<Trade, 'trade_date' | 'gross_pnl' | 'commission' | 'net_pnl'>

export interface PerformanceSummary {
  tradeCount: number
  grossPnl: number
  commissions: number
  netPnl: number
  // Share of trades with a positive net; null with no trades.
  winRatePct: number | null
  avgWin: number | null
  avgLoss: number | null
  // Gross wins / gross losses on net P&L; null when there are no losing trades.
  profitFactor: number | null
  tradingDays: number
  bestDay: number | null
  worstDay: number | null
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const mean = (values: number[]) => (values.length ? sum(values) / values.length : null)

export function summarizePerformance(trades: PerformanceTrade[]): PerformanceSummary {
  const wins = trades.filter((trade) => trade.net_pnl > 0).map((trade) => trade.net_pnl)
  const losses = trades.filter((trade) => trade.net_pnl < 0).map((trade) => trade.net_pnl)
  const days = [...dailyNetPnl(trades).values()]
  return {
    tradeCount: trades.length,
    grossPnl: sum(trades.map((trade) => trade.gross_pnl)),
    commissions: sum(trades.map((trade) => trade.commission)),
    netPnl: sum(trades.map((trade) => trade.net_pnl)),
    winRatePct: trades.length ? (wins.length / trades.length) * 100 : null,
    avgWin: mean(wins),
    avgLoss: mean(losses),
    profitFactor: losses.length ? sum(wins) / Math.abs(sum(losses)) : null,
    tradingDays: days.length,
    bestDay: days.length ? Math.max(...days) : null,
    worstDay: days.length ? Math.min(...days) : null,
  }
}

export interface DayPoint {
  date: string
  trades: number
  netPnl: number
  // Running net P&L through the end of this trading day.
  cumulative: number
}

// One point per trading day, oldest first.
export function dailySeries(trades: PerformanceTrade[]): DayPoint[] {
  const counts = new Map<string, number>()
  for (const trade of trades) counts.set(trade.trade_date, (counts.get(trade.trade_date) ?? 0) + 1)
  let cumulative = 0
  return [...dailyNetPnl(trades)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, netPnl]) => {
      cumulative += netPnl
      return { date, trades: counts.get(date) ?? 0, netPnl, cumulative }
    })
}

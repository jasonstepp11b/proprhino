import { averageHold, byEntryHour, byHoldTime, byWeekday, holdMs } from '@/lib/breakdowns'
import { dailySeries, summarizePerformance } from '@/lib/performance'
import { checkConsistency, checkTradingDays, cycleStart, tradesInCycle } from '@/lib/rules'
import { summarizeTags } from '@/lib/tags'
import type { Account, Payout, Tag, Trade, TradeTag } from '@/types/domain'

// Caps keep the request small however much history has been imported.
const MAX_DAYS = 120
const MAX_RECENT_TRADES = 150

export interface ReviewItem {
  title: string
  detail: string
  confidence?: 'low' | 'medium' | 'high'
}

// Shape the `review` edge function asks Claude to return.
export interface ReviewContent {
  summary: string
  strengths: ReviewItem[]
  leaks: ReviewItem[]
  rule_risks: ReviewItem[]
  actions: ReviewItem[]
  caveats: string
}

export interface Review {
  id: string
  account_id: string | null
  model: string
  trade_count: number
  content: ReviewContent
  created_at: string
}

interface ReviewInput {
  // Accounts and trades already narrowed to the scope being reviewed.
  scope: string
  accounts: Account[]
  trades: Trade[]
  payouts: Payout[]
  tags: Tag[]
  tradeTags: TradeTag[]
}

const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100)
const seconds = (ms: number | null) => (ms === null ? null : Math.round(ms / 1000))
const EASTERN = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// The statistics sent for review: everything the Performance, Compliance and
// Playbook pages show for this scope, plus the most recent trades.
export function buildReviewStats({ scope, accounts, trades, payouts, tags, tradeTags }: ReviewInput) {
  const summary = summarizePerformance(trades)
  const hold = averageHold(trades)
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]))
  const tagNamesByTrade = new Map<string, string[]>()
  for (const { trade_id, tag_id } of tradeTags) {
    const tag = tagsById.get(tag_id)
    if (tag) tagNamesByTrade.set(trade_id, [...(tagNamesByTrade.get(trade_id) ?? []), `${tag.kind}: ${tag.name}`])
  }
  const buckets = (rows: ReturnType<typeof byHoldTime>) =>
    rows.map((row) => ({ name: row.name, trades: row.trades, winRatePct: round(row.winRatePct), avgPnl: round(row.avgPnl), netPnl: round(row.netPnl) }))
  const tagStats = summarizeTags(tags, tradeTags, trades)
    .filter((row) => row.tradeCount > 0)
    .map((row) => ({ kind: row.tag.kind, name: row.tag.name, trades: row.tradeCount, winRatePct: round(row.winRatePct), netPnl: round(row.netPnl) }))

  return {
    scope,
    summary: {
      tradeCount: summary.tradeCount,
      tradingDays: summary.tradingDays,
      grossPnl: round(summary.grossPnl),
      commissions: round(summary.commissions),
      netPnl: round(summary.netPnl),
      winRatePct: round(summary.winRatePct),
      avgWin: round(summary.avgWin),
      avgLoss: round(summary.avgLoss),
      profitFactor: round(summary.profitFactor),
      bestDay: round(summary.bestDay),
      worstDay: round(summary.worstDay),
      avgHoldSecondsWinners: seconds(hold.winners),
      avgHoldSecondsLosers: seconds(hold.losers),
      untaggedTrades: trades.filter((trade) => !tagNamesByTrade.has(trade.id)).length,
    },
    byHoldTime: buckets(byHoldTime(trades)),
    byEntryHourEastern: buckets(byEntryHour(trades)),
    byWeekday: buckets(byWeekday(trades)),
    daily: dailySeries(trades)
      .slice(-MAX_DAYS)
      .map((day) => ({ date: day.date, trades: day.trades, netPnl: round(day.netPnl), cumulative: round(day.cumulative) })),
    accounts: accounts.map((account) => {
      const own = trades.filter((trade) => trade.account_id === account.id)
      const start = cycleStart(payouts.filter((payout) => payout.account_id === account.id).map((payout) => payout.paid_on))
      const cycle = tradesInCycle(own, start)
      const consistency = account.consistency_pct === null ? null : checkConsistency(cycle, account.consistency_pct)
      const days = account.min_trading_days === null ? null : checkTradingDays(cycle, account.min_trading_days)
      return {
        label: account.label,
        firm: account.firm_name,
        type: account.account_type,
        size: account.account_size,
        trades: own.length,
        netPnl: round(summarizePerformance(own).netPnl),
        rulesCountedSince: start ?? 'first import',
        consistency: consistency && {
          limitPct: consistency.limitPct,
          bestDayProfit: round(consistency.bestDayProfit),
          bestDayPctOfProfit: round(consistency.bestDayPct),
          withinLimit: consistency.compliant,
          profitNeededToComply: round(consistency.profitNeeded),
        },
        minimumTradingDays: days && { completed: days.completed, required: days.required },
      }
    }),
    tags: tagStats,
    recentTrades: [...trades]
      .sort((a, b) => a.exit_time.localeCompare(b.exit_time))
      .slice(-MAX_RECENT_TRADES)
      .map((trade) => ({
        tradingDay: trade.trade_date,
        enteredEastern: EASTERN.format(new Date(trade.entry_time)),
        symbol: trade.symbol,
        side: trade.direction,
        qty: trade.quantity,
        holdSeconds: seconds(holdMs(trade)),
        netPnl: round(trade.net_pnl),
        tags: tagNamesByTrade.get(trade.id) ?? [],
      })),
  }
}

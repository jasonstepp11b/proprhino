import { describe, expect, it } from 'vitest'
import type { Tag } from '@/types/domain'
import { averageHold, byEntryHour, byHoldTime, byWeekday } from './breakdowns'
import { formatDuration } from './format'
import { dailySeries, summarizePerformance } from './performance'
import { summarizeBusiness, summarizeByFirm } from './pnl'
import { summarizeTags } from './tags'
import { checkConsistency, checkTradingDays, cycleStart, tradesInCycle } from './rules'

describe('summarizeBusiness', () => {
  it('nets payouts against all expenses', () => {
    expect(summarizeBusiness([{ amount: 150 }, { amount: 50 }], [{ net_amount: 800 }])).toEqual({
      totalPayouts: 800,
      totalInvested: 200,
      netPnl: 600,
      roiPct: 300,
    })
  })

  it('has no ROI before any spend', () => {
    expect(summarizeBusiness([], []).roiPct).toBeNull()
  })
})

describe('summarizeByFirm', () => {
  it('groups by firm and skips overhead', () => {
    const accounts = [
      { id: 'a', firm_name: 'Topstep' },
      { id: 'b', firm_name: 'Apex' },
    ]
    const expenses = [
      { account_id: 'a', amount: 100 },
      { account_id: 'b', amount: 40 },
      { account_id: null, amount: 999 },
    ]
    const result = summarizeByFirm(accounts, expenses, [{ account_id: 'a', net_amount: 500 }])
    expect(result.map((firm) => [firm.firmName, firm.netPnl])).toEqual([
      ['Apex', -40],
      ['Topstep', 400],
    ])
  })
})

describe('rules', () => {
  const trades = [
    { trade_date: '2025-12-01', net_pnl: 300 },
    { trade_date: '2025-12-01', net_pnl: 100 },
    { trade_date: '2025-12-02', net_pnl: -100 },
    { trade_date: '2025-12-03', net_pnl: 700 },
  ]

  it('flags a best day above the consistency limit', () => {
    expect(checkConsistency(trades, 50)).toMatchObject({ totalProfit: 1000, bestDayProfit: 700, bestDayPct: 70, compliant: false })
    expect(checkConsistency(trades, 70).compliant).toBe(true)
  })

  it('reports the profit still needed to dilute the best day', () => {
    expect(checkConsistency(trades, 50).profitNeeded).toBe(400)
    expect(checkConsistency(trades, 70).profitNeeded).toBe(0)
  })

  it('only counts trading days after the latest payout', () => {
    const start = cycleStart(['2025-11-15', '2025-12-02', '2025-11-30'])
    expect(start).toBe('2025-12-02')
    expect(tradesInCycle(trades, start)).toEqual([{ trade_date: '2025-12-03', net_pnl: 700 }])
    expect(tradesInCycle(trades, cycleStart([]))).toHaveLength(4)
  })

  it('is not compliant without net profit', () => {
    expect(checkConsistency([{ trade_date: '2025-12-01', net_pnl: -50 }], 30)).toMatchObject({ bestDayPct: null, compliant: false })
  })

  it('counts distinct trading days', () => {
    expect(checkTradingDays(trades, 5)).toEqual({ completed: 3, required: 5, remaining: 2 })
  })
})

describe('performance', () => {
  const trades = [
    { trade_date: '2026-10-08', gross_pnl: -98, commission: 2, net_pnl: -100 },
    { trade_date: '2026-10-07', gross_pnl: 304, commission: 4, net_pnl: 300 },
    { trade_date: '2026-10-07', gross_pnl: -48, commission: 2, net_pnl: -50 },
    { trade_date: '2026-10-08', gross_pnl: 52, commission: 2, net_pnl: 50 },
  ]

  it('summarizes trade statistics', () => {
    expect(summarizePerformance(trades)).toEqual({
      tradeCount: 4,
      grossPnl: 210,
      commissions: 10,
      netPnl: 200,
      winRatePct: 50,
      avgWin: 175,
      avgLoss: -75,
      profitFactor: 350 / 150,
      tradingDays: 2,
      bestDay: 250,
      worstDay: -50,
    })
  })

  it('leaves ratios empty when they are undefined', () => {
    expect(summarizePerformance([])).toMatchObject({ winRatePct: null, avgWin: null, profitFactor: null, bestDay: null })
    expect(summarizePerformance([trades[1]]).profitFactor).toBeNull()
  })

  it('builds a cumulative series oldest day first', () => {
    expect(dailySeries(trades)).toEqual([
      { date: '2026-10-07', trades: 2, netPnl: 250, cumulative: 250 },
      { date: '2026-10-08', trades: 2, netPnl: -50, cumulative: 200 },
    ])
  })
})

describe('summarizeTags', () => {
  it('totals the trades carrying each tag', () => {
    const tags = [{ id: 'orb' }, { id: 'fomo' }, { id: 'unused' }] as Tag[]
    const trades = [
      { id: 't1', net_pnl: 100 },
      { id: 't2', net_pnl: -40 },
      { id: 't3', net_pnl: -60 },
    ]
    const tradeTags = [
      { trade_id: 't1', tag_id: 'orb' },
      { trade_id: 't2', tag_id: 'orb' },
      { trade_id: 't2', tag_id: 'fomo' },
      { trade_id: 't3', tag_id: 'fomo' },
      { trade_id: 'deleted', tag_id: 'fomo' },
    ]
    expect(summarizeTags(tags, tradeTags, trades).map(({ tag, ...rest }) => ({ id: tag.id, ...rest }))).toEqual([
      { id: 'orb', tradeCount: 2, netPnl: 60, winRatePct: 50 },
      { id: 'fomo', tradeCount: 2, netPnl: -100, winRatePct: 0 },
      { id: 'unused', tradeCount: 0, netPnl: 0, winRatePct: null },
    ])
  })
})

describe('breakdowns', () => {
  // Entry instants are given in Eastern time (EDT, UTC-4).
  const trade = (entry: string, holdSeconds: number, trade_date: string, net_pnl: number) => {
    const start = new Date(`${entry}-04:00`)
    return { entry_time: start.toISOString(), exit_time: new Date(start.getTime() + holdSeconds * 1000).toISOString(), trade_date, net_pnl }
  }
  const trades = [
    trade('2026-10-11T18:01:21', 34, '2026-10-12', -150),
    trade('2026-10-11T18:33:44', 47 * 60, '2026-10-12', 430),
    trade('2026-10-09T09:55:14', 7 * 3600, '2026-10-09', 1100),
    trade('2026-10-08T21:42:31', 7, '2026-10-09', -10),
  ]

  it('groups by hold time in duration order', () => {
    expect(byHoldTime(trades)).toEqual([
      { name: 'Under 1 min', trades: 2, winRatePct: 0, netPnl: -160, avgPnl: -80 },
      { name: '15–60 min', trades: 1, winRatePct: 100, netPnl: 430, avgPnl: 430 },
      { name: 'Over 1 hour', trades: 1, winRatePct: 100, netPnl: 1100, avgPnl: 1100 },
    ])
  })

  it('averages hold time for winners and losers', () => {
    expect(averageHold(trades)).toEqual({ winners: ((47 * 60 + 7 * 3600) / 2) * 1000, losers: 20_500 })
    expect(averageHold([])).toEqual({ winners: null, losers: null })
  })

  it('groups by Eastern entry hour in session order', () => {
    expect(byEntryHour(trades).map((bucket) => [bucket.name, bucket.trades, bucket.netPnl])).toEqual([
      ['6 PM', 2, 280],
      ['9 PM', 1, -10],
      ['9 AM', 1, 1100],
    ])
  })

  it('groups by the weekday of the trading day', () => {
    expect(byWeekday(trades).map((bucket) => [bucket.name, bucket.trades, bucket.winRatePct])).toEqual([
      ['Monday', 2, 50],
      ['Friday', 2, 50],
    ])
  })

  it('formats durations', () => {
    expect([45_000, 192_000, 7_041_000].map(formatDuration)).toEqual(['45s', '3m 12s', '1h 57m'])
  })
})

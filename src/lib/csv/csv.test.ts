import { describe, expect, it } from 'vitest'
import { parseTradeRows } from './index'
import { parseMoney, toTradeDate } from './shared'

describe('parseMoney', () => {
  it('handles the sign conventions found in exports', () => {
    expect(parseMoney('$1,234.50')).toBe(1234.5)
    expect(parseMoney('-$12.50')).toBe(-12.5)
    expect(parseMoney('($12.50)')).toBe(-12.5)
    expect(parseMoney('$(12.50)')).toBe(-12.5)
    expect(() => parseMoney('')).toThrow()
  })
})

describe('toTradeDate', () => {
  it('rolls to the next session at 6pm ET', () => {
    expect(toTradeDate(new Date('2026-10-09T16:50:03-04:00'))).toBe('2026-10-09')
    expect(toTradeDate(new Date('2026-10-06T17:59:59-04:00'))).toBe('2026-10-06')
    expect(toTradeDate(new Date('2026-10-06T18:00:00-04:00'))).toBe('2026-10-07')
    expect(toTradeDate(new Date('2026-10-07T00:34:00-04:00'))).toBe('2026-10-07')
  })

  it('counts Sunday evening as Monday and crosses month ends', () => {
    expect(toTradeDate(new Date('2026-10-11T18:01:21-04:00'))).toBe('2026-10-12')
    expect(toTradeDate(new Date('2026-12-31T19:00:00-05:00'))).toBe('2027-01-01')
  })
})

describe('parseTradeRows', () => {
  const tradovateHeaders = ['symbol', 'buyFillId', 'sellFillId', 'qty', 'buyPrice', 'sellPrice', 'pnl', 'boughtTimestamp', 'soldTimestamp']

  it('parses a Tradovate short', () => {
    const { platform, trades, errors } = parseTradeRows(tradovateHeaders, [
      {
        symbol: 'MESZ5',
        buyFillId: '2',
        sellFillId: '1',
        qty: '3',
        buyPrice: '6001.00',
        sellPrice: '6000.00',
        pnl: '$(15.00)',
        boughtTimestamp: '12/01/2025 09:35:00',
        soldTimestamp: '12/01/2025 09:31:05',
      },
    ])
    expect(platform).toBe('tradovate')
    expect(errors).toEqual([])
    expect(trades[0]).toMatchObject({
      symbol: 'MES',
      direction: 'short',
      quantity: 3,
      entry_price: 6000,
      exit_price: 6001,
      net_pnl: -15,
      trade_date: '2025-12-01',
      dedupe_key: 'tv:2:1#0',
    })
  })

  it('parses a NinjaTrader long and nets out commission', () => {
    const headers = ['Instrument', 'Market pos.', 'Qty', 'Entry price', 'Exit price', 'Entry time', 'Exit time', 'Profit', 'Commission']
    const row = {
      Instrument: 'MNQ 12-25',
      'Market pos.': 'Long',
      Qty: '2',
      'Entry price': '21000.25',
      'Exit price': '21010.25',
      'Entry time': '12/1/2025 9:31:05 AM',
      'Exit time': '12/1/2025 1:02:00 PM',
      Profit: '$40.00',
      Commission: '$2.08',
    }
    const { platform, trades } = parseTradeRows(headers, [row, row])
    expect(platform).toBe('ninjatrader')
    expect(trades[0]).toMatchObject({ symbol: 'MNQ', direction: 'long', gross_pnl: 40, commission: 2.08, net_pnl: 37.92 })
    expect(new Date(trades[0].exit_time).getHours()).toBe(13)
    expect(trades[0].dedupe_key).not.toBe(trades[1].dedupe_key)
  })

  it('reports bad rows without dropping good ones', () => {
    const good = { symbol: 'NQH6', qty: '1', buyPrice: '1', sellPrice: '2', pnl: '$20.00', boughtTimestamp: '01/05/2026 10:00:00', soldTimestamp: '01/05/2026 10:01:00' }
    const { trades, errors } = parseTradeRows(tradovateHeaders, [good, { ...good, pnl: 'n/a' }])
    expect(trades).toHaveLength(1)
    expect(errors).toEqual([{ row: 2, message: 'Invalid amount "n/a"' }])
  })

  it('charges Tradovate commissions by contract size', () => {
    const base = { qty: '5', buyPrice: '1', sellPrice: '2', pnl: '$35.00', boughtTimestamp: '01/05/2026 10:00:00', soldTimestamp: '01/05/2026 10:01:00' }
    const { trades } = parseTradeRows(
      tradovateHeaders,
      [
        { ...base, symbol: 'MNQH6', buyFillId: '1', sellFillId: '2' },
        { ...base, symbol: 'NQH6', buyFillId: '3', sellFillId: '4' },
      ],
      { micro: 1.04, standard: 4.5 },
    )
    expect(trades[0]).toMatchObject({ gross_pnl: 35, commission: 5.2, net_pnl: 29.8 })
    expect(trades[1]).toMatchObject({ gross_pnl: 35, commission: 22.5, net_pnl: 12.5 })
  })

  it('rejects unknown formats', () => {
    expect(() => parseTradeRows(['a', 'b'], [])).toThrow(/Unrecognized/)
  })
})

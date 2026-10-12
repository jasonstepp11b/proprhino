import { normalizeSymbol } from '@/lib/instruments'
import { parseMoney, parseNumber, parseRows, parseUsDateTime, toTradeDate } from './shared'
import type { CsvRow, ParseResult } from './types'

// NinjaTrader Trade Performance > Trades grid export.
export const NINJATRADER_HEADERS = ['Instrument', 'Market pos.', 'Qty', 'Entry price', 'Exit price', 'Entry time', 'Exit time', 'Profit', 'Commission']

export function parseNinjaTrader(rows: CsvRow[]): ParseResult {
  return parseRows('ninjatrader', rows, (row) => {
    const position = (row['Market pos.'] ?? '').trim().toLowerCase()
    if (position !== 'long' && position !== 'short') throw new Error(`Invalid Market pos. "${row['Market pos.'] ?? ''}"`)
    const entry = parseUsDateTime(row['Entry time'])
    const exit = parseUsDateTime(row['Exit time'])
    const quantity = parseNumber(row.Qty, 'Qty')
    const entryPrice = parseNumber(row['Entry price'], 'Entry price')
    const exitPrice = parseNumber(row['Exit price'], 'Exit price')
    // Profit is treated as gross; commission is subtracted to get net.
    const grossPnl = parseMoney(row.Profit)
    const commission = Math.abs(parseMoney(row.Commission))
    const symbol = normalizeSymbol(row.Instrument ?? '')
    if (!symbol) throw new Error('Missing Instrument')
    return {
      symbol,
      direction: position,
      quantity,
      entry_time: entry.toISOString(),
      exit_time: exit.toISOString(),
      entry_price: entryPrice,
      exit_price: exitPrice,
      gross_pnl: grossPnl,
      commission,
      net_pnl: Math.round((grossPnl - commission) * 100) / 100,
      trade_date: toTradeDate(exit),
      dedupe_key: `nt:${row.Instrument}:${row['Entry time']}:${row['Exit time']}:${position}:${quantity}:${entryPrice}:${exitPrice}`,
    }
  })
}

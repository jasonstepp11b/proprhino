import { normalizeSymbol } from '@/lib/instruments'
import { parseMoney, parseNumber, parseRows, parseUsDateTime, toTradeDate } from './shared'
import type { CsvRow, ParseResult } from './types'

// Tradovate "Performance" export: one row per matched buy/sell pair.
export const TRADOVATE_HEADERS = ['symbol', 'qty', 'buyPrice', 'sellPrice', 'pnl', 'boughtTimestamp', 'soldTimestamp']

export function parseTradovate(rows: CsvRow[]): ParseResult {
  return parseRows('tradovate', rows, (row) => {
    const bought = parseUsDateTime(row.boughtTimestamp)
    const sold = parseUsDateTime(row.soldTimestamp)
    const isLong = bought <= sold
    const entry = isLong ? bought : sold
    const exit = isLong ? sold : bought
    const buyPrice = parseNumber(row.buyPrice, 'buyPrice')
    const sellPrice = parseNumber(row.sellPrice, 'sellPrice')
    // The export has no commission column; parseTradeRows applies the
    // account's rates afterwards.
    const pnl = parseMoney(row.pnl)
    const quantity = parseNumber(row.qty, 'qty')
    const symbol = normalizeSymbol(row.symbol ?? '')
    if (!symbol) throw new Error('Missing symbol')
    return {
      symbol,
      direction: isLong ? 'long' : 'short',
      quantity,
      entry_time: entry.toISOString(),
      exit_time: exit.toISOString(),
      entry_price: isLong ? buyPrice : sellPrice,
      exit_price: isLong ? sellPrice : buyPrice,
      gross_pnl: pnl,
      commission: 0,
      net_pnl: pnl,
      trade_date: toTradeDate(exit),
      dedupe_key:
        row.buyFillId && row.sellFillId
          ? `tv:${row.buyFillId}:${row.sellFillId}`
          : `tv:${row.symbol}:${row.boughtTimestamp}:${row.soldTimestamp}:${quantity}:${buyPrice}:${sellPrice}`,
    }
  })
}

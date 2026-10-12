import Papa from 'papaparse'
import type { Platform } from '@/types/domain'
import { NINJATRADER_HEADERS, parseNinjaTrader } from './ninjatrader'
import { applyCommissions } from './shared'
import { TRADOVATE_HEADERS, parseTradovate } from './tradovate'
import type { CommissionRates, CsvRow, ParseResult } from './types'

export type { CommissionRates, ParsedTrade, ParseResult } from './types'

export function detectPlatform(headers: string[]): Platform | null {
  const present = new Set(headers)
  if (TRADOVATE_HEADERS.every((header) => present.has(header))) return 'tradovate'
  if (NINJATRADER_HEADERS.every((header) => present.has(header))) return 'ninjatrader'
  return null
}

// Rates only apply to Tradovate, whose export has no commission column;
// NinjaTrader rows carry their own.
export function withCommissions(result: ParseResult, rates: CommissionRates): ParseResult {
  return result.platform === 'tradovate' ? { ...result, trades: applyCommissions(result.trades, rates) } : result
}

export function parseTradeRows(headers: string[], rows: CsvRow[], rates?: CommissionRates): ParseResult {
  const platform = detectPlatform(headers)
  if (platform === 'tradovate') {
    const result = parseTradovate(rows)
    return rates ? withCommissions(result, rates) : result
  }
  if (platform === 'ninjatrader') return parseNinjaTrader(rows)
  throw new Error('Unrecognized CSV format. Expected a Tradovate Performance or NinjaTrader Trades export.')
}

// Papa reads the file in chunks, so large files do not block the UI.
export function parseTradeFile(file: File, rates?: CommissionRates): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        try {
          resolve(parseTradeRows(results.meta.fields ?? [], results.data, rates))
        } catch (error) {
          reject(error)
        }
      },
      error: reject,
    })
  })
}

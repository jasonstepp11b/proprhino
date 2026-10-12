import type { Platform, TradeDirection } from '@/types/domain'

export type CsvRow = Record<string, string>

// A trade ready to insert once an account_id / batch_id is attached.
export interface ParsedTrade {
  symbol: string
  direction: TradeDirection
  quantity: number
  entry_time: string
  exit_time: string
  entry_price: number | null
  exit_price: number | null
  gross_pnl: number
  commission: number
  net_pnl: number
  trade_date: string
  dedupe_key: string
}

export interface ParseResult {
  platform: Platform
  trades: ParsedTrade[]
  // Rows that could not be parsed, with 1-based data row numbers.
  errors: { row: number; message: string }[]
}

// Round-trip commission per contract, from the account the import maps to.
export interface CommissionRates {
  micro: number
  standard: number
}

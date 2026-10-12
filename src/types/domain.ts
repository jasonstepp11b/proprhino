// Row shapes mirroring supabase/migrations. Numeric columns arrive as numbers
// from PostgREST; dates as ISO strings.

export type AccountType = 'evaluation' | 'funded' | 'passed' | 'blown'
export type AccountStatus = 'active' | 'archived'
export type Platform = 'tradovate' | 'ninjatrader'
export type ExpenseCategory = 'challenge_purchase' | 'reset_fee' | 'activation_fee' | 'subscription'
export type TradeDirection = 'long' | 'short'
export type TagKind = 'setup' | 'mistake'

export interface Account {
  id: string
  user_id: string
  firm_name: string
  label: string
  account_size: number
  platform: Platform
  account_type: AccountType
  status: AccountStatus
  consistency_pct: number | null
  min_trading_days: number | null
  commission_micro: number
  commission_standard: number
  created_at: string
}

export interface Expense {
  id: string
  user_id: string
  account_id: string | null
  category: ExpenseCategory
  amount: number
  incurred_on: string
  note: string | null
  created_at: string
}

export interface Payout {
  id: string
  user_id: string
  account_id: string
  gross_amount: number
  split_pct: number
  net_amount: number
  paid_on: string
  created_at: string
}

export interface ImportBatch {
  id: string
  user_id: string
  account_id: string
  platform: Platform
  filename: string
  row_count: number
  created_at: string
}

export interface Trade {
  id: string
  user_id: string
  account_id: string
  batch_id: string | null
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
  created_at: string
}

export interface Tag {
  id: string
  user_id: string
  kind: TagKind
  name: string
  created_at: string
}

export interface TradeTag {
  trade_id: string
  tag_id: string
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  challenge_purchase: 'Challenge Purchase',
  reset_fee: 'Reset Fee',
  activation_fee: 'Activation Fee',
  subscription: 'Platform/Data Subscription',
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  evaluation: 'Evaluation',
  funded: 'Funded',
  passed: 'Passed',
  blown: 'Blown',
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  tradovate: 'Tradovate',
  ninjatrader: 'NinjaTrader',
}

export const TAG_KIND_LABELS: Record<TagKind, string> = {
  setup: 'Setups',
  mistake: 'Mistakes',
}

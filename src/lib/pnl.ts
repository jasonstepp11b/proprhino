import type { Account, Expense, Payout } from '@/types/domain'

export interface BusinessSummary {
  totalPayouts: number
  totalInvested: number
  netPnl: number
  // Null when nothing has been spent yet.
  roiPct: number | null
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

// Net P&L = sum of net payouts - sum of all expenses (purchases, resets,
// activations, subscriptions).
export function summarizeBusiness(expenses: Pick<Expense, 'amount'>[], payouts: Pick<Payout, 'net_amount'>[]): BusinessSummary {
  const totalPayouts = sum(payouts.map((payout) => payout.net_amount))
  const totalInvested = sum(expenses.map((expense) => expense.amount))
  const netPnl = totalPayouts - totalInvested
  return {
    totalPayouts,
    totalInvested,
    netPnl,
    roiPct: totalInvested > 0 ? (netPnl / totalInvested) * 100 : null,
  }
}

export interface FirmSummary extends BusinessSummary {
  firmName: string
}

// Per-firm spend vs payouts. Overhead expenses with no account are excluded
// because they belong to no firm.
export function summarizeByFirm(
  accounts: Pick<Account, 'id' | 'firm_name'>[],
  expenses: Pick<Expense, 'account_id' | 'amount'>[],
  payouts: Pick<Payout, 'account_id' | 'net_amount'>[],
): FirmSummary[] {
  const firmByAccount = new Map(accounts.map((account) => [account.id, account.firm_name]))
  const firms = [...new Set(firmByAccount.values())].sort()
  return firms.map((firmName) => ({
    firmName,
    ...summarizeBusiness(
      expenses.filter((expense) => expense.account_id !== null && firmByAccount.get(expense.account_id) === firmName),
      payouts.filter((payout) => firmByAccount.get(payout.account_id) === firmName),
    ),
  }))
}

import { CircleAlert, CircleCheck, CircleDashed, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatUsd } from '@/lib/format'
import { useAccounts, usePayouts, useTrades } from '@/lib/queries'
import { checkConsistency, checkTradingDays, cycleStart, tradesInCycle } from '@/lib/rules'
import { ACCOUNT_TYPE_LABELS, type Account, type Payout, type Trade } from '@/types/domain'

type Status = 'met' | 'unmet' | 'pending'

const STATUS: Record<Status, { icon: LucideIcon; color: string }> = {
  met: { icon: CircleCheck, color: 'var(--viz-good)' },
  unmet: { icon: CircleAlert, color: 'var(--viz-critical)' },
  pending: { icon: CircleDashed, color: 'var(--viz-muted)' },
}

// Horizontal meter. `limitPct` draws the rule's threshold as a tick.
function Meter({ valuePct, limitPct, status }: { valuePct: number; limitPct?: number; status: Status }) {
  return (
    <div className="relative h-2 rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, valuePct))}%`, background: STATUS[status].color }} />
      {limitPct !== undefined && <div className="absolute -top-1 h-4 w-0.5 bg-foreground" style={{ left: `${limitPct}%` }} />}
    </div>
  )
}

function Rule({ title, status, label, children }: { title: string; status: Status; label: string; children?: ReactNode }) {
  const Icon = STATUS[status].icon
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{title}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Icon className="size-4" style={{ color: STATUS[status].color }} />
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}

function ConsistencyRule({ trades, limitPct }: { trades: Trade[]; limitPct: number | null }) {
  if (limitPct === null) return <Rule title="Consistency" status="pending" label="No rule set" />
  const result = checkConsistency(trades, limitPct)
  if (result.bestDayPct === null) {
    return (
      <Rule title="Consistency" status="pending" label="No net profit yet">
        <Meter valuePct={0} limitPct={limitPct} status="pending" />
        <p className="text-xs text-muted-foreground">
          The best day must stay at or under {limitPct}% of total profit. Net so far: {formatUsd(result.totalProfit)}.
        </p>
      </Rule>
    )
  }
  const status = result.compliant ? 'met' : 'unmet'
  return (
    <Rule title="Consistency" status={status} label={result.compliant ? 'Within limit' : 'Over limit'}>
      <Meter valuePct={result.bestDayPct} limitPct={limitPct} status={status} />
      <p className="text-xs text-muted-foreground">
        Best day {formatUsd(result.bestDayProfit)} is <span className="font-medium text-foreground">{result.bestDayPct.toFixed(1)}%</span> of{' '}
        {formatUsd(result.totalProfit)} total profit; the limit is {limitPct}%.
        {!result.compliant && ` About ${formatUsd(result.profitNeeded)} more profit, with no day above ${formatUsd(result.bestDayProfit)}, brings it within the limit.`}
      </p>
    </Rule>
  )
}

function TradingDaysRule({ trades, required }: { trades: Trade[]; required: number | null }) {
  if (required === null) return <Rule title="Minimum trading days" status="pending" label="No rule set" />
  const result = checkTradingDays(trades, required)
  const status = result.remaining === 0 ? 'met' : 'unmet'
  return (
    <Rule title="Minimum trading days" status={status} label={status === 'met' ? 'Met' : `${result.remaining} more needed`}>
      <Meter valuePct={required === 0 ? 100 : (result.completed / required) * 100} status={status} />
      <p className="text-xs text-muted-foreground">
        {result.completed} of {required} trading days completed.
      </p>
    </Rule>
  )
}

function AccountCard({ account, trades, payouts }: { account: Account; trades: Trade[]; payouts: Payout[] }) {
  const start = cycleStart(payouts.map((payout) => payout.paid_on))
  const cycle = tradesInCycle(trades, start)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {account.label}
          <span className="font-normal text-muted-foreground">{account.firm_name}</span>
          <Badge variant="outline" className="ml-auto">
            {ACCOUNT_TYPE_LABELS[account.account_type]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ConsistencyRule trades={cycle} limitPct={account.consistency_pct} />
        <TradingDaysRule trades={cycle} required={account.min_trading_days} />
        <p className="text-xs text-muted-foreground">
          {start === null ? `Counting all ${cycle.length} imported trades.` : `Counting ${cycle.length} trades since the last payout on ${start}.`}
        </p>
      </CardContent>
    </Card>
  )
}

// Rule status for every live account. Blown and archived accounts are left out.
export function ComplianceView({ accounts, trades, payouts }: { accounts: Account[]; trades: Trade[]; payouts: Payout[] }) {
  const live = accounts.filter((account) => account.status === 'active' && account.account_type !== 'blown')
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Compliance</h1>
      {live.length === 0 && (
        <Card>
          <CardContent className="text-sm text-muted-foreground">No active accounts to track.</CardContent>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {live.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            trades={trades.filter((trade) => trade.account_id === account.id)}
            payouts={payouts.filter((payout) => payout.account_id === account.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function Compliance() {
  const accounts = useAccounts()
  const trades = useTrades()
  const payouts = usePayouts()
  const error = accounts.error ?? trades.error ?? payouts.error

  if (error) return <p className="text-sm text-red-500">Failed to load: {error.message}</p>
  if (!accounts.data || !trades.data || !payouts.data) return <p className="text-sm text-muted-foreground">Loading…</p>
  return <ComplianceView accounts={accounts.data} trades={trades.data} payouts={payouts.data} />
}

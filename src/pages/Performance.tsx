import { useMemo, useState } from 'react'
import { DataTable, type DataColumn } from '@/components/DataTable'
import { NativeSelect } from '@/components/FormDialog'
import { CategoryPnlBars, DailyPnlBars, EquityCurve } from '@/components/PnlCharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { averageHold, byEntryHour, byHoldTime, byWeekday, type Bucket } from '@/lib/breakdowns'
import { formatDuration, formatPct, formatUsd } from '@/lib/format'
import { dailySeries, summarizePerformance, type DayPoint, type PerformanceSummary } from '@/lib/performance'
import { useAccounts, useTrades } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { Account, Trade } from '@/types/domain'

const RIGHT = { className: 'text-right tabular-nums' }
const pnlColor = (value: number | null) => (value === null || value === 0 ? undefined : value > 0 ? 'text-emerald-500' : 'text-red-500')
const usd = (value: number | null) => (value === null ? '—' : formatUsd(value))

function Tile({ label, value, detail, className }: { label: string; value: string; detail?: string; className?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-semibold', className)}>{value}</div>
        {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
      </CardContent>
    </Card>
  )
}

// Net P&L per bucket as bars, with the counts and win rates behind them.
function Breakdown({ title, column, buckets, note }: { title: string; column: string; buckets: Bucket[]; note?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <CategoryPnlBars data={buckets} labelWidth={96} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{column}</TableHead>
              <TableHead className="text-right">Trades</TableHead>
              <TableHead className="text-right">Win rate</TableHead>
              <TableHead className="text-right">Avg</TableHead>
              <TableHead className="text-right">Net P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((bucket) => (
              <TableRow key={bucket.name}>
                <TableCell>{bucket.name}</TableCell>
                <TableCell className="text-right tabular-nums">{bucket.trades}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPct(bucket.winRatePct)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(bucket.avgPnl)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', pnlColor(bucket.netPnl))}>{formatUsd(bucket.netPnl)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  )
}

interface AccountRow extends PerformanceSummary {
  id: string
  label: string
}

const ACCOUNT_COLUMNS: DataColumn<AccountRow>[] = [
  { accessorKey: 'label', header: 'Account' },
  { accessorKey: 'tradeCount', header: 'Trades', meta: RIGHT },
  { accessorKey: 'tradingDays', header: 'Days', meta: RIGHT },
  { accessorKey: 'winRatePct', header: 'Win rate', meta: RIGHT, cell: ({ row }) => formatPct(row.original.winRatePct) },
  { accessorKey: 'profitFactor', header: 'Profit factor', meta: RIGHT, cell: ({ row }) => row.original.profitFactor?.toFixed(2) ?? '—' },
  { accessorKey: 'grossPnl', header: 'Gross', meta: RIGHT, cell: ({ row }) => formatUsd(row.original.grossPnl) },
  { accessorKey: 'commissions', header: 'Comm.', meta: RIGHT, cell: ({ row }) => formatUsd(row.original.commissions) },
  {
    accessorKey: 'netPnl',
    header: 'Net P&L',
    meta: RIGHT,
    cell: ({ row }) => <span className={pnlColor(row.original.netPnl)}>{formatUsd(row.original.netPnl)}</span>,
  },
]

const DAY_COLUMNS: DataColumn<DayPoint>[] = [
  { accessorKey: 'date', header: 'Trading day' },
  { accessorKey: 'trades', header: 'Trades', meta: RIGHT },
  {
    accessorKey: 'netPnl',
    header: 'Net P&L',
    meta: RIGHT,
    cell: ({ row }) => <span className={pnlColor(row.original.netPnl)}>{formatUsd(row.original.netPnl)}</span>,
  },
  { accessorKey: 'cumulative', header: 'Cumulative', meta: RIGHT, enableSorting: false, cell: ({ row }) => formatUsd(row.original.cumulative) },
]

// Trading performance for one account or all of them, from imported trades.
export function PerformanceView({ accounts, trades }: { accounts: Account[]; trades: Trade[] }) {
  const [filter, setFilter] = useState('')
  const visible = useMemo(() => (filter ? trades.filter((trade) => trade.account_id === filter) : trades), [trades, filter])
  const summary = useMemo(() => summarizePerformance(visible), [visible])
  const days = useMemo(() => dailySeries(visible), [visible])
  const hold = useMemo(() => averageHold(visible), [visible])
  const duration = (ms: number | null) => (ms === null ? '—' : formatDuration(ms))
  const byAccount = useMemo<AccountRow[]>(
    () =>
      accounts
        .map((account) => ({ id: account.id, label: account.label, ...summarizePerformance(trades.filter((trade) => trade.account_id === account.id)) }))
        .filter((row) => row.tradeCount > 0),
    [accounts, trades],
  )
  const scope = accounts.find((account) => account.id === filter)?.label ?? 'all accounts'

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Performance</h1>
        <NativeSelect aria-label="Account" className="ml-auto w-56" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">No trades for {scope} yet. Import a CSV on the Trades page.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile
              label="Net P&L"
              value={formatUsd(summary.netPnl)}
              detail={`${formatUsd(summary.grossPnl)} gross − ${formatUsd(summary.commissions)} commissions`}
              className={pnlColor(summary.netPnl)}
            />
            <Tile label="Win rate" value={formatPct(summary.winRatePct)} detail={`${summary.tradeCount} trades over ${summary.tradingDays} trading days`} />
            <Tile label="Profit factor" value={summary.profitFactor?.toFixed(2) ?? '—'} detail={`Avg win ${usd(summary.avgWin)} · avg loss ${usd(summary.avgLoss)}`} />
            <Tile label="Best / worst day" value={`${usd(summary.bestDay)} / ${usd(summary.worstDay)}`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cumulative net P&L, {scope}</CardTitle>
              </CardHeader>
              <CardContent>
                <EquityCurve days={days} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Net P&L by trading day, {scope}</CardTitle>
              </CardHeader>
              <CardContent>
                <DailyPnlBars days={days} />
              </CardContent>
            </Card>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-3">
            <Breakdown
              title={`By hold time, ${scope}`}
              column="Held for"
              buckets={byHoldTime(visible)}
              note={`Average hold: winners ${duration(hold.winners)} · losers ${duration(hold.losers)}`}
            />
            <Breakdown title={`By entry time, ${scope}`} column="Entered (ET)" buckets={byEntryHour(visible)} note="Hours are Eastern time, listed from the 6 PM session open." />
            <Breakdown title={`By day of week, ${scope}`} column="Trading day" buckets={byWeekday(visible)} note="Sunday-evening trades count as Monday." />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">By account</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={ACCOUNT_COLUMNS} data={byAccount} initialSorting={[{ id: 'netPnl', desc: true }]} empty="No trades yet." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">By trading day, {scope}</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={DAY_COLUMNS} data={days} initialSorting={[{ id: 'date', desc: true }]} empty="No trades yet." pageSize={20} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export function Performance() {
  const accounts = useAccounts()
  const trades = useTrades()
  const error = accounts.error ?? trades.error

  if (error) return <p className="text-sm text-red-500">Failed to load: {error.message}</p>
  if (!accounts.data || !trades.data) return <p className="text-sm text-muted-foreground">Loading…</p>
  return <PerformanceView accounts={accounts.data} trades={trades.data} />
}

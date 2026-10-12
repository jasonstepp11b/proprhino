import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatPct, formatUsd } from '@/lib/format'
import { summarizeBusiness, summarizeByFirm } from '@/lib/pnl'
import { useAccounts, useExpenses, usePayouts } from '@/lib/queries'
import { cn } from '@/lib/utils'

const pnlColor = (value: number) => (value > 0 ? 'text-emerald-500' : value < 0 ? 'text-red-500' : undefined)

function Kpi({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className={cn('text-2xl font-semibold tabular-nums', className)}>{value}</CardContent>
    </Card>
  )
}

export function Dashboard() {
  const accounts = useAccounts()
  const expenses = useExpenses()
  const payouts = usePayouts()
  const error = accounts.error ?? expenses.error ?? payouts.error

  if (error) return <p className="text-sm text-red-500">Failed to load: {error.message}</p>
  if (!accounts.data || !expenses.data || !payouts.data) return <p className="text-sm text-muted-foreground">Loading…</p>

  const summary = summarizeBusiness(expenses.data, payouts.data)
  const firms = summarizeByFirm(accounts.data, expenses.data, payouts.data)
  const funded = accounts.data.filter((account) => account.account_type === 'funded' && account.status === 'active').length
  const blown = accounts.data.filter((account) => account.account_type === 'blown').length

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Net Business P&L" value={formatUsd(summary.netPnl)} className={pnlColor(summary.netPnl)} />
        <Kpi label="Total Capital Invested" value={formatUsd(summary.totalInvested)} />
        <Kpi label="Overall ROI" value={formatPct(summary.roiPct)} className={pnlColor(summary.roiPct ?? 0)} />
        <Kpi label="Active Funded / Blown" value={`${funded} / ${blown}`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Firm Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Firm</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Payouts</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {firms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No accounts yet.
                  </TableCell>
                </TableRow>
              )}
              {firms.map((firm) => (
                <TableRow key={firm.firmName}>
                  <TableCell>{firm.firmName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(firm.totalInvested)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(firm.totalPayouts)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', pnlColor(firm.netPnl))}>{formatUsd(firm.netPnl)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPct(firm.roiPct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

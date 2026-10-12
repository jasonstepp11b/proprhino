import { useState } from 'react'
import { Field, FormDialog, NativeSelect } from '@/components/FormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { number, optionalNumber, text } from '@/lib/form'
import { formatUsd } from '@/lib/format'
import { useAccounts, useSaveRow } from '@/lib/queries'
import { ACCOUNT_TYPE_LABELS, PLATFORM_LABELS, type Account, type AccountType, type Platform } from '@/types/domain'

const TYPE_BADGE: Record<AccountType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  evaluation: 'outline',
  funded: 'default',
  passed: 'secondary',
  blown: 'destructive',
}

// `null` = closed, 'new' = creating, otherwise the account being edited.
type Editing = Account | 'new' | null

export function Accounts() {
  const { data: accounts, error, isPending } = useAccounts()
  const save = useSaveRow<Account>('accounts')
  const [editing, setEditing] = useState<Editing>(null)
  const [showArchived, setShowArchived] = useState(false)

  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p className="text-sm text-red-500">Failed to load: {error.message}</p>

  const account = editing === 'new' ? null : editing
  const visible = accounts.filter((row) => showArchived || row.status === 'active')
  const archivedCount = accounts.filter((row) => row.status === 'archived').length

  async function handleSubmit(data: FormData) {
    await save.mutateAsync({
      id: account?.id,
      values: {
        label: text(data, 'label'),
        firm_name: text(data, 'firm_name'),
        account_size: number(data, 'account_size'),
        platform: text(data, 'platform') as Platform,
        account_type: text(data, 'account_type') as AccountType,
        consistency_pct: optionalNumber(data, 'consistency_pct'),
        min_trading_days: optionalNumber(data, 'min_trading_days'),
        commission_micro: number(data, 'commission_micro'),
        commission_standard: number(data, 'commission_standard'),
      },
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Accounts</h1>
        {archivedCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
          </Button>
        )}
        <Button className="ml-auto" onClick={() => setEditing('new')}>
          New account
        </Button>
      </div>
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Firm</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Consistency</TableHead>
                <TableHead className="text-right">Min days</TableHead>
                <TableHead className="text-right">Comm. micro / std</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No accounts yet.
                  </TableCell>
                </TableRow>
              )}
              {visible.map((row) => (
                <TableRow key={row.id} className={row.status === 'archived' ? 'opacity-60' : undefined}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell>{row.firm_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(row.account_size)}</TableCell>
                  <TableCell>{PLATFORM_LABELS[row.platform]}</TableCell>
                  <TableCell>
                    <Badge variant={TYPE_BADGE[row.account_type]}>{ACCOUNT_TYPE_LABELS[row.account_type]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.consistency_pct === null ? '—' : `${row.consistency_pct}%`}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.min_trading_days ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsd(row.commission_micro)} / {formatUsd(row.commission_standard)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={save.isPending}
                      onClick={() => save.mutate({ id: row.id, values: { status: row.status === 'active' ? 'archived' : 'active' } })}
                    >
                      {row.status === 'active' ? 'Archive' : 'Restore'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FormDialog
        key={account?.id ?? 'new'}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={account ? 'Edit account' : 'New account'}
        onSubmit={handleSubmit}
      >
        <Field label="Account name" htmlFor="label">
          <Input id="label" name="label" required placeholder="50K Combine #1" defaultValue={account?.label} />
        </Field>
        <Field label="Firm" htmlFor="firm_name">
          <Input id="firm_name" name="firm_name" required placeholder="Topstep" defaultValue={account?.firm_name} />
        </Field>
        <Field label="Account size ($)" htmlFor="account_size">
          <Input id="account_size" name="account_size" type="number" required min="1" step="any" placeholder="50000" defaultValue={account?.account_size} />
        </Field>
        <Field label="Platform" htmlFor="platform">
          <NativeSelect id="platform" name="platform" defaultValue={account?.platform ?? 'tradovate'}>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Type" htmlFor="account_type" wide>
          <NativeSelect id="account_type" name="account_type" defaultValue={account?.account_type ?? 'evaluation'}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Consistency limit (%)" htmlFor="consistency_pct">
          <Input id="consistency_pct" name="consistency_pct" type="number" min="1" max="100" step="any" placeholder="None" defaultValue={account?.consistency_pct ?? ''} />
        </Field>
        <Field label="Min trading days" htmlFor="min_trading_days">
          <Input id="min_trading_days" name="min_trading_days" type="number" min="0" step="1" placeholder="None" defaultValue={account?.min_trading_days ?? ''} />
        </Field>
        <Field label="Commission, micro ($/contract RT)" htmlFor="commission_micro">
          <Input id="commission_micro" name="commission_micro" type="number" required min="0" step="0.01" defaultValue={account?.commission_micro ?? 0} />
        </Field>
        <Field label="Commission, standard ($/contract RT)" htmlFor="commission_standard">
          <Input id="commission_standard" name="commission_standard" type="number" required min="0" step="0.01" defaultValue={account?.commission_standard ?? 0} />
        </Field>
      </FormDialog>
    </div>
  )
}

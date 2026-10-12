import { useMemo, useState } from 'react'
import { DataTable, type DataColumn } from '@/components/DataTable'
import { Field, FormDialog, NativeSelect } from '@/components/FormDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { number, optionalNumber, text, today } from '@/lib/form'
import { formatUsd } from '@/lib/format'
import { useAccounts, useDeleteRow, useExpenses, usePayouts, useSaveRow } from '@/lib/queries'
import { EXPENSE_CATEGORY_LABELS, type Account, type Expense, type ExpenseCategory, type Payout } from '@/types/domain'

const RIGHT = { className: 'text-right tabular-nums' }
const toCents = (value: number) => Math.round(value * 100) / 100

// `null` = closed, 'new' = creating, otherwise the row being edited.
type Editing<T> = T | 'new' | null

function AccountOptions({ accounts, selectedId }: { accounts: Account[]; selectedId?: string | null }) {
  // Archived accounts stay hidden unless the row being edited already uses one.
  return accounts
    .filter((account) => account.status === 'active' || account.id === selectedId)
    .map((account) => (
      <option key={account.id} value={account.id}>
        {account.label} ({account.firm_name})
      </option>
    ))
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
      <Button variant="ghost" size="sm" onClick={() => window.confirm('Delete this entry?') && onDelete()}>
        Delete
      </Button>
    </>
  )
}

function Expenses({ accounts, accountName }: { accounts: Account[]; accountName: (id: string | null) => string }) {
  const { data: expenses = [], error } = useExpenses()
  const save = useSaveRow<Expense>('expenses')
  const remove = useDeleteRow('expenses')
  const removeRow = remove.mutate
  const [editing, setEditing] = useState<Editing<Expense>>(null)
  const expense = editing === 'new' ? null : editing

  const columns = useMemo<DataColumn<Expense>[]>(
    () => [
      { accessorKey: 'incurred_on', header: 'Date' },
      { id: 'category', header: 'Category', accessorFn: (row) => EXPENSE_CATEGORY_LABELS[row.category] },
      { id: 'account', header: 'Account', accessorFn: (row) => accountName(row.account_id) },
      { accessorKey: 'note', header: 'Note', enableSorting: false },
      { accessorKey: 'amount', header: 'Amount', meta: RIGHT, cell: ({ row }) => formatUsd(row.original.amount) },
      {
        id: 'actions',
        header: '',
        meta: { className: 'text-right' },
        cell: ({ row }) => <RowActions onEdit={() => setEditing(row.original)} onDelete={() => removeRow(row.original.id)} />,
      },
    ],
    [accountName, removeRow],
  )

  async function handleSubmit(data: FormData) {
    await save.mutateAsync({
      id: expense?.id,
      values: {
        incurred_on: text(data, 'incurred_on'),
        category: text(data, 'category') as ExpenseCategory,
        account_id: text(data, 'account_id') || null,
        amount: number(data, 'amount'),
        note: text(data, 'note') || null,
      },
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center">
        <p className="text-sm text-muted-foreground">
          Total spent: <span className="font-medium text-foreground tabular-nums">{formatUsd(expenses.reduce((total, row) => total + row.amount, 0))}</span>
        </p>
        <Button className="ml-auto" onClick={() => setEditing('new')}>
          Add expense
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">Failed to load: {error.message}</p>}
      {remove.error && <p className="text-sm text-red-500">Delete failed: {remove.error.message}</p>}
      <Card>
        <CardContent>
          <DataTable columns={columns} data={expenses} initialSorting={[{ id: 'incurred_on', desc: true }]} empty="No expenses yet." />
        </CardContent>
      </Card>
      <FormDialog
        key={expense?.id ?? 'new'}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={expense ? 'Edit expense' : 'Add expense'}
        onSubmit={handleSubmit}
      >
        <Field label="Date" htmlFor="incurred_on">
          <Input id="incurred_on" name="incurred_on" type="date" required defaultValue={expense?.incurred_on ?? today()} />
        </Field>
        <Field label="Amount ($)" htmlFor="amount">
          <Input id="amount" name="amount" type="number" required min="0.01" step="0.01" defaultValue={expense?.amount} />
        </Field>
        <Field label="Category" htmlFor="category">
          <NativeSelect id="category" name="category" defaultValue={expense?.category ?? 'challenge_purchase'}>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Account" htmlFor="account_id">
          <NativeSelect id="account_id" name="account_id" defaultValue={expense?.account_id ?? ''}>
            <option value="">General overhead</option>
            <AccountOptions accounts={accounts} selectedId={expense?.account_id} />
          </NativeSelect>
        </Field>
        <Field label="Note" htmlFor="note" wide>
          <Input id="note" name="note" defaultValue={expense?.note ?? ''} />
        </Field>
      </FormDialog>
    </div>
  )
}

function Payouts({ accounts, accountName }: { accounts: Account[]; accountName: (id: string | null) => string }) {
  const { data: payouts = [], error } = usePayouts()
  const save = useSaveRow<Payout>('payouts')
  const remove = useDeleteRow('payouts')
  const removeRow = remove.mutate
  const [editing, setEditing] = useState<Editing<Payout>>(null)
  const payout = editing === 'new' ? null : editing
  const hasAccounts = accounts.some((account) => account.status === 'active')

  const columns = useMemo<DataColumn<Payout>[]>(
    () => [
      { accessorKey: 'paid_on', header: 'Date' },
      { id: 'account', header: 'Account', accessorFn: (row) => accountName(row.account_id) },
      { accessorKey: 'gross_amount', header: 'Gross', meta: RIGHT, cell: ({ row }) => formatUsd(row.original.gross_amount) },
      { accessorKey: 'split_pct', header: 'Your split', meta: RIGHT, cell: ({ row }) => `${row.original.split_pct}%` },
      { accessorKey: 'net_amount', header: 'Net received', meta: RIGHT, cell: ({ row }) => formatUsd(row.original.net_amount) },
      {
        id: 'actions',
        header: '',
        meta: { className: 'text-right' },
        cell: ({ row }) => <RowActions onEdit={() => setEditing(row.original)} onDelete={() => removeRow(row.original.id)} />,
      },
    ],
    [accountName, removeRow],
  )

  async function handleSubmit(data: FormData) {
    const gross = number(data, 'gross_amount')
    const split = number(data, 'split_pct')
    await save.mutateAsync({
      id: payout?.id,
      values: {
        paid_on: text(data, 'paid_on'),
        account_id: text(data, 'account_id'),
        gross_amount: gross,
        split_pct: split,
        // Left blank, net is derived from the split.
        net_amount: optionalNumber(data, 'net_amount') ?? toCents((gross * split) / 100),
      },
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center">
        <p className="text-sm text-muted-foreground">
          Total received: <span className="font-medium text-foreground tabular-nums">{formatUsd(payouts.reduce((total, row) => total + row.net_amount, 0))}</span>
        </p>
        <Button className="ml-auto" disabled={!hasAccounts} onClick={() => setEditing('new')}>
          Add payout
        </Button>
      </div>
      {!hasAccounts && <p className="text-sm text-muted-foreground">Create an account first; every payout belongs to one.</p>}
      {error && <p className="text-sm text-red-500">Failed to load: {error.message}</p>}
      {remove.error && <p className="text-sm text-red-500">Delete failed: {remove.error.message}</p>}
      <Card>
        <CardContent>
          <DataTable columns={columns} data={payouts} initialSorting={[{ id: 'paid_on', desc: true }]} empty="No payouts yet." />
        </CardContent>
      </Card>
      <FormDialog
        key={payout?.id ?? 'new'}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={payout ? 'Edit payout' : 'Add payout'}
        onSubmit={handleSubmit}
      >
        <Field label="Date" htmlFor="paid_on">
          <Input id="paid_on" name="paid_on" type="date" required defaultValue={payout?.paid_on ?? today()} />
        </Field>
        <Field label="Account" htmlFor="payout_account_id">
          <NativeSelect id="payout_account_id" name="account_id" required defaultValue={payout?.account_id}>
            <AccountOptions accounts={accounts} selectedId={payout?.account_id} />
          </NativeSelect>
        </Field>
        <Field label="Gross payout ($)" htmlFor="gross_amount">
          <Input id="gross_amount" name="gross_amount" type="number" required min="0.01" step="0.01" defaultValue={payout?.gross_amount} />
        </Field>
        <Field label="Your split (%)" htmlFor="split_pct">
          <Input id="split_pct" name="split_pct" type="number" required min="1" max="100" step="any" defaultValue={payout?.split_pct ?? 90} />
        </Field>
        <Field label="Net received ($)" htmlFor="net_amount" wide>
          <Input id="net_amount" name="net_amount" type="number" min="0" step="0.01" placeholder="Leave blank to use gross × split" defaultValue={payout?.net_amount} />
        </Field>
      </FormDialog>
    </div>
  )
}

export function Ledger() {
  const { data: accounts = [] } = useAccounts()
  const accountName = useMemo(() => {
    const labels = new Map(accounts.map((account) => [account.id, account.label]))
    return (id: string | null) => (id === null ? 'General overhead' : (labels.get(id) ?? 'Unknown'))
  }, [accounts])

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Ledger</h1>
      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses">
          <Expenses accounts={accounts} accountName={accountName} />
        </TabsContent>
        <TabsContent value="payouts">
          <Payouts accounts={accounts} accountName={accountName} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

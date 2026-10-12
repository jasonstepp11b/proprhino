import { createContext, useContext, useMemo, useState, type ChangeEvent } from 'react'
import { DataTable, type DataColumn } from '@/components/DataTable'
import { NativeSelect } from '@/components/FormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseTradeFile, withCommissions, type ParseResult } from '@/lib/csv'
import { formatUsd } from '@/lib/format'
import { useAccounts, useDeleteBatch, useImportBatches, useImportTrades, useTags, useTagTrades, useTrades, useTradeTags } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { PLATFORM_LABELS, TAG_KIND_LABELS, type Account, type Tag, type TagKind, type Trade } from '@/types/domain'

const RIGHT = { className: 'text-right tabular-nums' }
const pnlColor = (value: number) => (value > 0 ? 'text-emerald-500' : value < 0 ? 'text-red-500' : undefined)
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const formatTime = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('font-medium tabular-nums', className)}>{value}</div>
    </div>
  )
}

interface Selection {
  selected: ReadonlySet<string>
  total: number
  allSelected: boolean
  toggle: (id: string) => void
  toggleAll: (checked: boolean) => void
}

// Row selection lives in context so the table's column definitions stay
// stable while checkboxes change.
const SelectionContext = createContext<Selection>({ selected: new Set(), total: 0, allSelected: false, toggle: () => {}, toggleAll: () => {} })

function SelectAll() {
  const { total, allSelected, toggleAll } = useContext(SelectionContext)
  return <input type="checkbox" aria-label={`Select all ${total} trades`} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
}

function SelectCell({ id }: { id: string }) {
  const { selected, toggle } = useContext(SelectionContext)
  return <input type="checkbox" aria-label="Select trade" checked={selected.has(id)} onChange={() => toggle(id)} />
}

function ImportCard({ accounts }: { accounts: Account[] }) {
  const importTrades = useImportTrades()
  const [accountId, setAccountId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  // Bumped to clear the file input after an import or cancel.
  const [inputKey, setInputKey] = useState(0)

  const account = accounts.find((row) => row.id === accountId) ?? accounts[0]
  const preview = useMemo(
    () => (parsed && account ? withCommissions(parsed, { micro: account.commission_micro, standard: account.commission_standard }) : null),
    [parsed, account],
  )

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null
    setFile(chosen)
    setParsed(null)
    setMessage(null)
    if (!chosen) return
    try {
      setParsed(await parseTradeFile(chosen))
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  function reset() {
    setFile(null)
    setParsed(null)
    setInputKey((key) => key + 1)
  }

  async function handleImport() {
    if (!preview || !file || !account) return
    try {
      const { inserted, skipped } = await importTrades.mutateAsync({ accountId: account.id, platform: preview.platform, filename: file.name, trades: preview.trades })
      setMessage({ text: `Imported ${inserted} trade${inserted === 1 ? '' : 's'} into ${account.label}${skipped > 0 ? `; skipped ${skipped} already imported` : ''}.` })
      reset()
    } catch (error) {
      setMessage({ text: `Import failed: ${error instanceof Error ? error.message : String(error)}`, error: true })
    }
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">Create an account first; every import is mapped to one.</CardContent>
      </Card>
    )
  }

  const days = preview ? preview.trades.map((trade) => trade.trade_date).sort() : []
  const net = preview ? sum(preview.trades.map((trade) => trade.net_pnl)) : 0
  const noRates = account.commission_micro === 0 && account.commission_standard === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Import trades</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="import_account">Account</Label>
            <NativeSelect id="import_account" value={account.id} onChange={(event) => setAccountId(event.target.value)}>
              {accounts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label} ({row.firm_name})
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="import_file">Tradovate Performance CSV</Label>
            <Input key={inputKey} id="import_file" type="file" accept=".csv,text/csv" onChange={handleFile} />
          </div>
        </div>

        {preview && (
          <div className="grid gap-3 rounded-lg border p-3 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <Stat label="Format" value={PLATFORM_LABELS[preview.platform]} />
              <Stat label="Trades" value={String(preview.trades.length)} />
              <Stat label="Trading days" value={days.length ? `${days[0]} → ${days[days.length - 1]}` : '—'} />
              <Stat label="Gross P&L" value={formatUsd(sum(preview.trades.map((trade) => trade.gross_pnl)))} />
              <Stat label="Commissions" value={formatUsd(sum(preview.trades.map((trade) => trade.commission)))} />
              <Stat label="Net P&L" value={formatUsd(net)} className={pnlColor(net)} />
            </div>
            {preview.platform === 'tradovate' && noRates && (
              <p className="text-amber-500">This account has no commission rates set, so net P&L will equal gross. Set them on the Accounts page before importing.</p>
            )}
            {preview.errors.length > 0 && (
              <div className="text-red-500">
                {preview.errors.length} row{preview.errors.length === 1 ? '' : 's'} could not be read and will be skipped:
                <ul className="list-disc pl-5">
                  {preview.errors.slice(0, 5).map((error) => (
                    <li key={error.row}>
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                  {preview.errors.length > 5 && <li>…and {preview.errors.length - 5} more</li>}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button disabled={importTrades.isPending || preview.trades.length === 0} onClick={handleImport}>
                {importTrades.isPending ? 'Importing…' : `Import into ${account.label}`}
              </Button>
              <Button variant="outline" disabled={importTrades.isPending} onClick={reset}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {message && <p className={cn('text-sm', message.error ? 'text-red-500' : 'text-emerald-500')}>{message.text}</p>}
      </CardContent>
    </Card>
  )
}

export function Trades() {
  const { data: accounts = [], error: accountsError } = useAccounts()
  const { data: trades = [], error: tradesError, isPending } = useTrades()
  const { data: batches = [] } = useImportBatches()
  const deleteBatch = useDeleteBatch()
  const { data: tags = [] } = useTags()
  const { data: tradeTags = [] } = useTradeTags()
  const tagTrades = useTagTrades()
  const [filter, setFilter] = useState('')
  // '' = any, 'untagged', or a tag id.
  const [tagFilter, setTagFilter] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [bulkTagId, setBulkTagId] = useState('')

  const accountLabel = useMemo(() => {
    const labels = new Map(accounts.map((account) => [account.id, account.label]))
    return (id: string) => labels.get(id) ?? 'Unknown'
  }, [accounts])

  const tagsByTrade = useMemo(() => {
    const byId = new Map(tags.map((tag) => [tag.id, tag]))
    const result = new Map<string, Tag[]>()
    for (const { trade_id, tag_id } of tradeTags) {
      const tag = byId.get(tag_id)
      if (tag) result.set(trade_id, [...(result.get(trade_id) ?? []), tag])
    }
    return result
  }, [tags, tradeTags])

  const visible = useMemo(
    () =>
      trades.filter((trade) => {
        if (filter && trade.account_id !== filter) return false
        const tradeTagList = tagsByTrade.get(trade.id) ?? []
        if (tagFilter === 'untagged') return tradeTagList.length === 0
        return !tagFilter || tradeTagList.some((tag) => tag.id === tagFilter)
      }),
    [trades, filter, tagFilter, tagsByTrade],
  )
  const selection = useMemo<Selection>(
    () => ({
      selected,
      total: visible.length,
      allSelected: visible.length > 0 && visible.every((trade) => selected.has(trade.id)),
      toggle: (id) =>
        setSelected((current) => {
          const next = new Set(current)
          if (!next.delete(id)) next.add(id)
          return next
        }),
      toggleAll: (checked) => setSelected(checked ? new Set(visible.map((trade) => trade.id)) : new Set()),
    }),
    [selected, visible],
  )

  const columns = useMemo<DataColumn<Trade>[]>(
    () => [
      { id: 'select', enableSorting: false, header: () => <SelectAll />, cell: ({ row }) => <SelectCell id={row.original.id} /> },
      { accessorKey: 'trade_date', header: 'Trading day' },
      { id: 'account', header: 'Account', accessorFn: (row) => accountLabel(row.account_id) },
      { accessorKey: 'symbol', header: 'Symbol' },
      { accessorKey: 'direction', header: 'Side', cell: ({ row }) => (row.original.direction === 'long' ? 'Long' : 'Short') },
      { accessorKey: 'quantity', header: 'Qty', meta: RIGHT },
      { accessorKey: 'entry_time', header: 'Entry time', cell: ({ row }) => formatTime(row.original.entry_time) },
      { accessorKey: 'exit_time', header: 'Exit time', cell: ({ row }) => formatTime(row.original.exit_time) },
      { accessorKey: 'entry_price', header: 'Entry', meta: RIGHT },
      { accessorKey: 'exit_price', header: 'Exit', meta: RIGHT },
      { accessorKey: 'gross_pnl', header: 'Gross', meta: RIGHT, cell: ({ row }) => formatUsd(row.original.gross_pnl) },
      { accessorKey: 'commission', header: 'Comm.', meta: RIGHT, cell: ({ row }) => formatUsd(row.original.commission) },
      {
        accessorKey: 'net_pnl',
        header: 'Net',
        meta: RIGHT,
        cell: ({ row }) => <span className={pnlColor(row.original.net_pnl)}>{formatUsd(row.original.net_pnl)}</span>,
      },
      {
        id: 'tags',
        header: 'Tags',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            {(tagsByTrade.get(row.original.id) ?? []).map((tag) => (
              <Badge key={tag.id} variant={tag.kind === 'mistake' ? 'destructive' : 'secondary'}>
                {tag.name}
              </Badge>
            ))}
          </span>
        ),
      },
    ],
    [accountLabel, tagsByTrade],
  )

  const tagOptions = (Object.keys(TAG_KIND_LABELS) as TagKind[]).map((kind) => (
    <optgroup key={kind} label={TAG_KIND_LABELS[kind]}>
      {tags
        .filter((tag) => tag.kind === kind)
        .map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
    </optgroup>
  ))
  const bulkTag = tags.find((tag) => tag.id === bulkTagId) ?? tags[0]

  function applyTag(action: 'add' | 'remove') {
    if (!bulkTag) return
    tagTrades.mutate({ tagId: bulkTag.id, tradeIds: [...selected], action }, { onSuccess: () => setSelected(new Set()) })
  }

  const error = accountsError ?? tradesError
  const activeAccounts = accounts.filter((account) => account.status === 'active')
  const net = sum(visible.map((trade) => trade.net_pnl))

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Trades</h1>
      {error && <p className="text-sm text-red-500">Failed to load: {error.message}</p>}
      <ImportCard accounts={activeAccounts} />

      {batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Imports</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {deleteBatch.error && <p className="text-red-500">Delete failed: {deleteBatch.error.message}</p>}
            {batches.map((batch) => (
              <div key={batch.id} className="flex items-center gap-3">
                <span className="font-medium">{batch.filename}</span>
                <span className="text-muted-foreground">
                  {batch.row_count} trades into {accountLabel(batch.account_id)} on {new Date(batch.created_at).toLocaleDateString('en-US')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  disabled={deleteBatch.isPending}
                  onClick={() => window.confirm(`Delete this import and its ${batch.row_count} trades?`) && deleteBatch.mutate(batch.id)}
                >
                  Delete import
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <CardTitle className="text-sm">Trade log</CardTitle>
          <span className="text-sm text-muted-foreground">
            {visible.length} trades, net <span className={cn('font-medium tabular-nums', pnlColor(net))}>{formatUsd(net)}</span>
          </span>
          <NativeSelect
            aria-label="Filter by tag"
            className="ml-auto w-44"
            value={tagFilter}
            onChange={(event) => {
              setTagFilter(event.target.value)
              setSelected(new Set())
            }}
          >
            <option value="">All tags</option>
            <option value="untagged">Untagged</option>
            {tagOptions}
          </NativeSelect>
          <NativeSelect
            aria-label="Filter by account"
            className="w-56"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value)
              setSelected(new Set())
            }}
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </NativeSelect>
        </CardHeader>
        <CardContent className="grid gap-3">
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              {bulkTag ? (
                <>
                  <NativeSelect aria-label="Tag" className="w-48" value={bulkTag.id} onChange={(event) => setBulkTagId(event.target.value)}>
                    {tagOptions}
                  </NativeSelect>
                  <Button size="sm" disabled={tagTrades.isPending} onClick={() => applyTag('add')}>
                    Add tag
                  </Button>
                  <Button size="sm" variant="outline" disabled={tagTrades.isPending} onClick={() => applyTag('remove')}>
                    Remove tag
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground">Create setups and mistakes on the Playbook page to tag trades.</span>
              )}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
              {tagTrades.error && <span className="basis-full text-red-500">Tagging failed: {tagTrades.error.message}</span>}
            </div>
          )}
          <SelectionContext value={selection}>
            <DataTable
              columns={columns}
              data={visible}
              initialSorting={[{ id: 'exit_time', desc: true }]}
              empty={isPending ? 'Loading…' : 'No trades imported yet.'}
              pageSize={50}
            />
          </SelectionContext>
        </CardContent>
      </Card>
    </div>
  )
}

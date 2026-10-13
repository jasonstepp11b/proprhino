import { useState, type FormEvent } from 'react'
import { Field, FormDialog } from '@/components/FormDialog'
import { CategoryPnlBars } from '@/components/PnlCharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { text } from '@/lib/form'
import { formatPct, formatUsd } from '@/lib/format'
import { useDeleteRow, useSaveRow, useTags, useTrades, useTradeTags } from '@/lib/queries'
import { summarizeTags, type TagSummary } from '@/lib/tags'
import { cn } from '@/lib/utils'
import type { Tag, TagKind } from '@/types/domain'

const COPY: Record<TagKind, { title: string; chart: string; placeholder: string; empty: string }> = {
  setup: { title: 'Setups', chart: 'Net P&L by setup', placeholder: 'New setup, e.g. VWAP Pullback', empty: 'No setups yet.' },
  mistake: { title: 'Mistakes', chart: 'Net P&L of trades tagged with each mistake', placeholder: 'New mistake, e.g. FOMO Entry', empty: 'No mistakes yet.' },
}

const pnlColor = (value: number) => (value > 0 ? 'text-primary' : value < 0 ? 'text-destructive' : undefined)

// Postgres unique-violation code, raised when the name is already taken.
function friendly(error: unknown): Error {
  if ((error as { code?: string }).code === '23505') return new Error('A tag with that name already exists.')
  return error instanceof Error ? error : new Error(String(error))
}

function TagSection({ kind, summaries }: { kind: TagKind; summaries: TagSummary[] }) {
  const save = useSaveRow<Tag>('tags')
  const remove = useDeleteRow('tags')
  const [name, setName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Tag | null>(null)
  const copy = COPY[kind]
  const tagged = summaries.filter((summary) => summary.tradeCount > 0).sort((a, b) => b.netPnl - a.netPnl)

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setAddError(null)
    try {
      await save.mutateAsync({ values: { kind, name: name.trim() } })
      setName('')
    } catch (error) {
      setAddError(friendly(error).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {tagged.length > 0 && (
          <div>
            <div className="mb-2 text-xs text-muted-foreground">{copy.chart}</div>
            <CategoryPnlBars data={tagged.map((summary) => ({ name: summary.tag.name, trades: summary.tradeCount, netPnl: summary.netPnl }))} />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Trades</TableHead>
              <TableHead className="text-right">Win rate</TableHead>
              <TableHead className="text-right">Net P&L</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {copy.empty}
                </TableCell>
              </TableRow>
            )}
            {summaries.map(({ tag, tradeCount, netPnl, winRatePct }) => (
              <TableRow key={tag.id}>
                <TableCell className="font-medium">{tag.name}</TableCell>
                <TableCell className="text-right tabular-nums">{tradeCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPct(winRatePct)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', pnlColor(netPnl))}>{tradeCount ? formatUsd(netPnl) : '—'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setRenaming(tag)}>
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      window.confirm(`Delete "${tag.name}"?${tradeCount ? ` It will be removed from ${tradeCount} trade${tradeCount === 1 ? '' : 's'}.` : ''}`) &&
                      remove.mutate(tag.id)
                    }
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input aria-label={copy.placeholder} placeholder={copy.placeholder} required value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="submit" disabled={save.isPending}>
            Add
          </Button>
        </form>
        {addError && <p className="text-sm text-destructive">{addError}</p>}
        {remove.error && <p className="text-sm text-destructive">Delete failed: {remove.error.message}</p>}
      </CardContent>

      <FormDialog
        key={renaming?.id}
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Rename tag"
        onSubmit={async (data) => {
          try {
            await save.mutateAsync({ id: renaming?.id, values: { name: text(data, 'name') } })
          } catch (error) {
            throw friendly(error)
          }
        }}
      >
        <Field label="Name" htmlFor="tag_name" wide>
          <Input id="tag_name" name="name" required defaultValue={renaming?.name} />
        </Field>
      </FormDialog>
    </Card>
  )
}

export function Playbook() {
  const tags = useTags()
  const tradeTags = useTradeTags()
  const trades = useTrades()
  const error = tags.error ?? tradeTags.error ?? trades.error

  if (error) return <p className="text-sm text-destructive">Failed to load: {error.message}</p>
  if (!tags.data || !tradeTags.data || !trades.data) return <p className="text-sm text-muted-foreground">Loading…</p>

  const summaries = summarizeTags(tags.data, tradeTags.data, trades.data)
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
        <p className="text-sm text-muted-foreground">Create setups and mistakes here, then apply them to trades on the Trades page by ticking rows.</p>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <TagSection kind="setup" summaries={summaries.filter((summary) => summary.tag.kind === 'setup')} />
        <TagSection kind="mistake" summaries={summaries.filter((summary) => summary.tag.kind === 'mistake')} />
      </div>
    </div>
  )
}

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable, type DataColumn } from './DataTable'

interface Row {
  day: string
  amount: number
}

const columns: DataColumn<Row>[] = [
  { accessorKey: 'day', header: 'Date' },
  { accessorKey: 'amount', header: 'Amount', meta: { className: 'text-right' }, cell: ({ row }) => `$${row.original.amount}` },
]
const data: Row[] = [
  { day: '2026-10-07', amount: 24 },
  { day: '2026-10-12', amount: 72 },
  { day: '2026-10-09', amount: 752 },
]

describe('DataTable', () => {
  it('renders rows in the initial sort order with custom cells', () => {
    const html = renderToString(<DataTable columns={columns} data={data} initialSorting={[{ id: 'day', desc: true }]} empty="None" />)
    const order = ['2026-10-12', '2026-10-09', '2026-10-07'].map((day) => html.indexOf(day))
    expect(order.every((index) => index > -1)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(html).toContain('$752')
    expect(html).toContain('text-right')
    expect(html).toContain('Amount')
  })

  it('paginates when a page size is set', () => {
    const html = renderToString(<DataTable columns={columns} data={data} initialSorting={[{ id: 'day', desc: true }]} empty="None" pageSize={2} />)
    expect(html).toContain('2026-10-12')
    expect(html).not.toContain('2026-10-07')
    expect(html).toMatch(/Page <!-- -->1<!-- --> of <!-- -->2/)
  })

  it('shows the empty message', () => {
    expect(renderToString(<DataTable columns={columns} data={[]} empty="No rows yet." />)).toContain('No rows yet.')
  })
})

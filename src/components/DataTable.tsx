import {
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

// Set `meta: { className }` on a column to style its header and cells.
export type DataColumn<TData extends RowData> = ColumnDef<typeof features, TData>

const columnClass = (meta: unknown) => (meta as { className?: string } | undefined)?.className

interface DataTableProps<TData extends RowData> {
  columns: DataColumn<TData>[]
  data: TData[]
  initialSorting?: SortingState
  empty: string
  // Rows per page; omit to show every row.
  pageSize?: number
}

// Sortable table; click a header to sort by that column.
export function DataTable<TData extends RowData>({ columns, data, initialSorting = [], empty, pageSize }: DataTableProps<TData>) {
  const table = useTable({
    features,
    columns,
    data,
    initialState: { sorting: initialSorting, pagination: { pageIndex: 0, pageSize: pageSize ?? Number.MAX_SAFE_INTEGER } },
  })
  const pageCount = table.getPageCount()
  const pageIndex = table.state.pagination.pageIndex

  return (
    <>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    className={cn(header.column.getCanSort() && 'cursor-pointer select-none', columnClass(header.column.columnDef.meta))}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <table.FlexRender header={header} />
                    {sorted === 'asc' && <ArrowUp className="ml-1 inline size-3" />}
                    {sorted === 'desc' && <ArrowDown className="ml-1 inline size-3" />}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          )}
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className={columnClass(cell.column.columnDef.meta)}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
          Page {pageIndex + 1} of {pageCount}
          <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            Next
          </Button>
        </div>
      )}
    </>
  )
}

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { isWeekend, monthLabel, monthWeeks, shiftMonth } from '@/lib/calendar'
import { formatUsd } from '@/lib/format'
import type { DayPoint } from '@/lib/performance'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Total {
  netPnl: number
  trades: number
}

const total = (days: DayPoint[]): Total => ({ netPnl: days.reduce((sum, day) => sum + day.netPnl, 0), trades: days.reduce((sum, day) => sum + day.trades, 0) })

// Tint strength follows the size of the day's result relative to the biggest
// day shown, so the eye lands on the days that mattered.
function tint(netPnl: number, largest: number): string | undefined {
  if (netPnl === 0 || largest === 0) return undefined
  const strength = Math.round(10 + 30 * (Math.abs(netPnl) / largest))
  return `color-mix(in srgb, var(${netPnl > 0 ? '--viz-gain' : '--viz-loss'}) ${strength}%, transparent)`
}

function Cell({ label, value, className, background }: { label: string; value?: Total; className?: string; background?: string }) {
  return (
    <div className={cn('flex min-h-20 flex-col rounded-lg border p-2', className)} style={{ background }}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {value && value.trades > 0 && (
        <>
          <span className="mt-auto font-semibold tabular-nums">{formatUsd(value.netPnl)}</span>
          <span className="text-xs text-muted-foreground">
            {value.trades} trade{value.trades === 1 ? '' : 's'}
          </span>
        </>
      )}
    </div>
  )
}

// Month calendar of net P&L per trading day, with a total for each week.
// Renders nothing until there is at least one trading day.
export function PnlCalendar({ days }: { days: DayPoint[] }) {
  const latestMonth = days.at(-1)?.date.slice(0, 7)
  // Null until the user navigates, so the view tracks the newest month.
  const [chosen, setChosen] = useState<string | null>(null)
  const month = chosen ?? latestMonth
  if (!month) return null

  const inMonth = days.filter((day) => day.date.startsWith(month))
  const byDate = new Map(inMonth.map((day) => [day.date, day]))
  const includeWeekends = inMonth.some((day) => isWeekend(day.date))
  const weeks = monthWeeks(month, includeWeekends)
  const largest = Math.max(0, ...inMonth.map((day) => Math.abs(day.netPnl)))
  const monthTotal = total(inMonth)
  const columns = includeWeekends ? 8 : 6

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" aria-label="Previous month" onClick={() => setChosen(shiftMonth(month, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="w-36 text-center font-medium">{monthLabel(month)}</span>
        <Button variant="outline" size="sm" aria-label="Next month" onClick={() => setChosen(shiftMonth(month, 1))}>
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-auto text-muted-foreground">
          {monthTotal.trades > 0 ? (
            <>
              Month: <span className="font-semibold text-foreground tabular-nums">{formatUsd(monthTotal.netPnl)}</span> over {inMonth.length} trading day
              {inMonth.length === 1 ? '' : 's'}
            </>
          ) : (
            'No trades this month'
          )}
        </span>
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {[...WEEKDAYS.slice(0, columns - 1), 'Week'].map((name) => (
          <div key={name} className="px-2 text-xs font-medium text-muted-foreground">
            {name}
          </div>
        ))}
        {weeks.map((week, index) => {
          const traded = week.flatMap((date) => (date && byDate.get(date)) || [])
          return [
            ...week.map((date, slot) =>
              date ? (
                <Cell key={date} label={String(Number(date.slice(8)))} value={byDate.get(date)} background={tint(byDate.get(date)?.netPnl ?? 0, largest)} />
              ) : (
                <div key={`${index}-${slot}`} />
              ),
            ),
            <Cell key={`week-${index}`} label={`Week ${index + 1}`} value={total(traded)} className="border-dashed" />,
          ]
        })}
      </div>
    </div>
  )
}

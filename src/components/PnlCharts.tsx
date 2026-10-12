import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDay, formatUsd, formatUsdCompact } from '@/lib/format'
import type { DayPoint } from '@/lib/performance'

const AXIS_TICK = { fill: 'var(--viz-muted)', fontSize: 12 }
const MARGIN = { top: 8, right: 12, bottom: 0, left: 0 }
type Domain = [number | 'auto', number | 'auto']

// Value axes always include zero so bar lengths are comparable, while the
// other end keeps the library's rounded ticks.
function zeroBasedDomain(values: number[]): Domain {
  if (values.every((value) => value >= 0)) return [0, 'auto']
  if (values.every((value) => value <= 0)) return ['auto', 0]
  return ['auto', 'auto']
}

interface TooltipState {
  active?: boolean
  payload?: readonly { payload?: DayPoint }[]
}

// Value leads, context follows. `field` picks which number the chart plots.
function DayTooltip({ active, payload, field }: TooltipState & { field: 'cumulative' | 'netPnl' }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <div className="font-semibold tabular-nums">{formatUsd(point[field])}</div>
      <div className="text-xs text-muted-foreground">
        {point.trades === 0 ? 'Start' : `${point.date} · ${field === 'cumulative' ? `${formatUsd(point.netPnl)} that day` : `${point.trades} trade${point.trades === 1 ? '' : 's'}`}`}
      </div>
    </div>
  )
}

function Axes(domain: Domain) {
  return (
    <>
      <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
      <XAxis dataKey="date" tickFormatter={(date: string) => (date ? formatDay(date) : '')} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
      <YAxis domain={domain} tickFormatter={formatUsdCompact} tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} />
      <ReferenceLine y={0} stroke="var(--viz-axis)" />
    </>
  )
}

// Cumulative net P&L by trading day, starting from zero.
export function EquityCurve({ days }: { days: DayPoint[] }) {
  const data = [{ date: '', trades: 0, netPnl: 0, cumulative: 0 }, ...days]
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={MARGIN}>
        {Axes(zeroBasedDomain(data.map((point) => point.cumulative)))}
        <Tooltip content={(props) => <DayTooltip {...(props as TooltipState)} field="cumulative" />} cursor={{ stroke: 'var(--viz-axis)' }} />
        <Area
          type="linear"
          dataKey="cumulative"
          stroke="var(--viz-gain)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="var(--viz-gain)"
          fillOpacity={0.1}
          activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Net P&L per trading day; bars above the baseline are gains, below are losses.
export function DailyPnlBars({ days }: { days: DayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={days} margin={MARGIN}>
        {Axes(zeroBasedDomain(days.map((day) => day.netPnl)))}
        <Tooltip content={(props) => <DayTooltip {...(props as TooltipState)} field="netPnl" />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
        <Bar dataKey="netPnl" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {days.map((day) => (
            <Cell key={day.date} fill={day.netPnl >= 0 ? 'var(--viz-gain)' : 'var(--viz-loss)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface CategoryPoint {
  name: string
  trades: number
  netPnl: number
}

function CategoryTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: CategoryPoint }[] }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <div className="font-semibold tabular-nums">{formatUsd(point.netPnl)}</div>
      <div className="text-xs text-muted-foreground">
        {point.name} · {point.trades} trade{point.trades === 1 ? '' : 's'}
      </div>
    </div>
  )
}

// Net P&L per category as horizontal bars: gains extend right of zero,
// losses left.
export function CategoryPnlBars({ data, labelWidth = 150 }: { data: CategoryPoint[]; labelWidth?: number }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
        <XAxis type="number" domain={zeroBasedDomain(data.map((point) => point.netPnl))} tickFormatter={formatUsdCompact} tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fill: 'var(--foreground)' }} tickLine={false} axisLine={false} width={labelWidth} />
        <ReferenceLine x={0} stroke="var(--viz-axis)" />
        <Tooltip content={(props) => <CategoryTooltip {...(props as { active?: boolean; payload?: readonly { payload?: CategoryPoint }[] })} />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
        <Bar dataKey="netPnl" maxBarSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((point) => (
            <Cell key={point.name} fill={point.netPnl >= 0 ? 'var(--viz-gain)' : 'var(--viz-loss)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

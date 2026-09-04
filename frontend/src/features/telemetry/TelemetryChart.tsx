import { memo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TelemetryPoint } from '@/types/api'
import { clockTime, num } from '@/lib/format'

export interface ChartSpec {
  key: keyof Pick<TelemetryPoint, 'temperature' | 'vibration' | 'current' | 'gas' | 'anomaly_score'>
  label: string
  unit: string
  color: string
  /** Interlock threshold drawn as a dashed reference line, when one applies. */
  threshold?: number
}

/**
 * One live trace. Animation is disabled: at 1.5 s frames the re-animation
 * fights the incoming data and costs frames on a tablet.
 */
function TelemetryChartBase({
  spec,
  points,
  lite,
}: {
  spec: ChartSpec
  points: TelemetryPoint[]
  lite: boolean
}) {
  const latest = points.length ? Number(points[points.length - 1][spec.key]) : null
  const gradientId = `grad-${spec.key}`

  return (
    <div className="rounded-ctl border border-hairline bg-raised p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink">{spec.label}</span>
        <span className="label-xs">{spec.unit}</span>
      </div>

      <div className="mt-1 h-[132px] w-full sm:h-[148px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 6, right: 4, bottom: 0, left: -22 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={spec.color} stopOpacity={lite ? 0.18 : 0.35} />
                <stop offset="100%" stopColor={spec.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#232a33" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={clockTime}
              tick={{ fill: '#8b98a5', fontSize: 9 }}
              stroke="#232a33"
              minTickGap={40}
            />
            <YAxis tick={{ fill: '#8b98a5', fontSize: 9 }} stroke="#232a33" width={44} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{
                background: '#12161c',
                border: '1px solid #232a33',
                borderRadius: 10,
                fontSize: 11,
                color: '#e6edf3',
              }}
              labelFormatter={(v) => clockTime(String(v))}
              formatter={(v: number | string) => [`${num(Number(v), 2)} ${spec.unit}`, spec.label]}
            />
            {spec.threshold !== undefined && (
              <ReferenceLine
                y={spec.threshold}
                stroke="#f85149"
                strokeDasharray="4 4"
                label={{ value: 'trip', fill: '#f85149', fontSize: 9, position: 'insideTopRight' }}
              />
            )}
            <Area
              type="monotone"
              dataKey={spec.key}
              stroke={spec.color}
              strokeWidth={1.8}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="tnum mt-1 text-lg font-semibold" style={{ color: spec.color }}>
        {latest === null ? '—' : num(latest, 1)}
      </div>
    </div>
  )
}

export default memo(TelemetryChartBase)

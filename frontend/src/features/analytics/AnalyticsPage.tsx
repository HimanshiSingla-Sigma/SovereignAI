import { useEffect } from 'react'
import { AlertTriangle, Gauge, TrendingUp } from 'lucide-react'
import { useCorrelation, useMachineHealth, useMachines } from '@/hooks/useApi'
import { useSelectionStore } from '@/store/selectionStore'
import { anomalySeverity, healthSeverity, num, severityOf, severityText } from '@/lib/format'
import { pickDefaultMachine } from '@/lib/pickMachine'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel, Stat } from '@/components/ui'
import MachineChips from '@/components/MachineChips'

/** Diverging heatmap cell: cyan for negative correlation, amber for positive. */
function heatColor(v: number): string {
  const magnitude = Math.min(1, Math.abs(v))
  if (v >= 0) return `rgba(245, 166, 35, ${0.08 + magnitude * 0.62})`
  return `rgba(34, 211, 238, ${0.08 + magnitude * 0.62})`
}

export default function AnalyticsPage() {
  const machines = useMachines()
  const { machineId, select } = useSelectionStore()

  useEffect(() => {
    if (!machineId) {
      const preferred = pickDefaultMachine(machines.data)
      if (preferred) select(preferred)
    }
  }, [machineId, machines.data, select])

  const health = useMachineHealth(machineId)
  const correlation = useCorrelation(machineId)

  const matrix = correlation.data?.correlation_matrix ?? {}
  const params = Object.keys(matrix)

  return (
    <div className="space-y-4">
      <PageHeader title="Industrial analytics" subtitle="Predictive health, RUL and multi-sensor correlation" />

      {machines.isPending && <Loading label="Loading assets…" />}
      {machines.isError && <ErrorState error={machines.error} onRetry={() => machines.refetch()} />}

      {machines.data && machines.data.length > 0 && (
        <>
          <div>
            <div className="label-xs mb-2">Assets</div>
            <MachineChips machines={machines.data} selected={machineId} onSelect={(id) => select(id)} />
          </div>

          <Panel title="Health &amp; remaining useful life" subtitle={machineId ?? undefined}>
            {health.isPending && <Loading label="Computing health model…" />}
            {health.isError && <ErrorState error={health.error} onRetry={() => health.refetch()} />}
            {health.data && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <Stat label="Health" value={num(health.data.health_score, 1)} severity={healthSeverity(health.data.health_score)} />
                  <Stat
                    label="Risk"
                    value={num(health.data.risk_score, 1)}
                    severity={health.data.risk_score > 60 ? 'crit' : health.data.risk_score > 30 ? 'warn' : 'ok'}
                  />
                  <Stat
                    label="Failure probability"
                    value={`${num(health.data.failure_probability * 100, 1)}%`}
                    severity={health.data.failure_probability > 0.6 ? 'crit' : health.data.failure_probability > 0.3 ? 'warn' : 'ok'}
                  />
                  <Stat label="Estimated RUL" value={num(health.data.estimated_rul_hours, 1)} unit="h" severity="info" />
                  <Stat
                    label="Priority"
                    value={health.data.maintenance_priority}
                    severity={severityOf(health.data.maintenance_priority === 'HIGH' ? 'WARNING' : health.data.maintenance_priority)}
                  />
                </div>

                <div className="mt-4">
                  <div className="label-xs mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Recommended actions
                  </div>
                  <ul className="space-y-2">
                    {health.data.recommended_actions.map((action) => (
                      <li
                        key={action}
                        className="rounded-ctl border border-hairline bg-raised px-3 py-2 text-xs leading-relaxed text-ink"
                      >
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Cross-sensor correlation matrix"
              subtitle="Pearson correlation across the live sensor window"
              right={
                correlation.data && (
                  <Badge severity={anomalySeverity(correlation.data.anomaly_score)}>
                    <Gauge className="h-3 w-3" /> anomaly {num(correlation.data.anomaly_score, 1)}
                  </Badge>
                )
              }
              bodyClass="p-3 sm:p-4"
            >
              {correlation.isPending && <Loading label="Correlating sensors…" />}
              {correlation.isError && <ErrorState error={correlation.error} onRetry={() => correlation.refetch()} />}
              {correlation.data && params.length === 0 && (
                <EmptyState label="Not enough telemetry recorded yet." hint="Let the stream run for a few seconds." />
              )}
              {params.length > 0 && (
                <div className="table-scroll">
                  <table className="w-full min-w-[420px] border-separate border-spacing-1">
                    <thead>
                      <tr>
                        <th className="label-xs text-left" />
                        {params.map((p) => (
                          <th key={p} className="label-xs px-1 pb-1 text-center">
                            {p.slice(0, 4)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {params.map((row) => (
                        <tr key={row}>
                          <th className="label-xs whitespace-nowrap pr-2 text-right font-normal">{row}</th>
                          {params.map((col) => {
                            const v = matrix[row]?.[col] ?? 0
                            return (
                              <td
                                key={col}
                                className="tnum h-11 rounded-[6px] border border-hairline text-center text-[11px] text-ink"
                                style={{ background: heatColor(v) }}
                                title={`${row} ↔ ${col}: ${v.toFixed(3)}`}
                              >
                                {v.toFixed(2)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-6 rounded" style={{ background: heatColor(1) }} /> positive
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-6 rounded" style={{ background: heatColor(-1) }} /> negative
                    </span>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Detected patterns" subtitle={correlation.data?.status}>
              {correlation.data && (
                <div className="space-y-4">
                  <div>
                    <div className="label-xs mb-2">Patterns</div>
                    {correlation.data.detected_patterns.length === 0 ? (
                      <p className="text-xs text-muted">No abnormal spectral patterns detected.</p>
                    ) : (
                      <ul className="space-y-2">
                        {correlation.data.detected_patterns.map((p) => (
                          <li key={p} className="rounded-ctl border border-hairline bg-raised px-3 py-2 text-xs text-ink">
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div className="label-xs mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" /> Cross-sensor inconsistencies
                    </div>
                    {correlation.data.cross_sensor_inconsistencies.length === 0 ? (
                      <p className="text-xs text-muted">All sensors are physically consistent with each other.</p>
                    ) : (
                      <ul className="space-y-2">
                        {correlation.data.cross_sensor_inconsistencies.map((p) => (
                          <li key={p} className={`rounded-ctl border border-warn/40 bg-warn/5 px-3 py-2 text-xs ${severityText.warn}`}>
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

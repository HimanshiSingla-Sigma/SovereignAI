import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Cog, Gauge, Radio } from 'lucide-react'
import { useMachine, useMachines } from '@/hooks/useApi'
import { useSelectionStore } from '@/store/selectionStore'
import { useAlertStore } from '@/store/alertStore'
import { anomalySeverity, healthSeverity, num, severityOf, severityText } from '@/lib/format'
import { pickDefaultMachine } from '@/lib/pickMachine'
import { Badge, Bar, EmptyState, ErrorState, Loading, PageHeader, Panel, Stat, StatusDot } from '@/components/ui'
import MachineChips from '@/components/MachineChips'

export default function DigitalTwinPage() {
  const machines = useMachines()
  const { machineId, select, zoomedFrom, clearZoom } = useSelectionStore()
  const live = useAlertStore((s) => s.live)

  // Default to the first machine, or keep the one God View zoomed into.
  useEffect(() => {
    if (!machineId) {
      const preferred = pickDefaultMachine(machines.data)
      if (preferred) select(preferred)
    }
  }, [machineId, machines.data, select])

  // The zoom-in flourish plays once after arriving from the plant floor.
  useEffect(() => {
    if (!zoomedFrom) return
    const id = window.setTimeout(clearZoom, 600)
    return () => window.clearTimeout(id)
  }, [zoomedFrom, clearZoom])

  const machine = useMachine(machineId)
  const l = machineId ? live[machineId] : undefined

  const status = l?.status ?? machine.data?.status ?? 'UNKNOWN'
  const health = l ? Math.max(0, 100 - l.anomalyScore * 0.8) : (machine.data?.health_score ?? 0)
  const risk = l ? Math.min(100, l.anomalyScore * 0.9) : (machine.data?.risk_score ?? 0)
  const anomaly = l?.anomalyScore ?? machine.data?.anomaly_score ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Digital twin"
        subtitle={machine.data ? machine.data.name : 'Live asset model'}
        right={
          machineId && (
            <Link to="/telemetry" className="btn btn-sm">
              <Activity className="h-3.5 w-3.5" /> Open telemetry
            </Link>
          )
        }
      />

      {machines.isPending && <Loading label="Loading assets…" />}
      {machines.isError && <ErrorState error={machines.error} onRetry={() => machines.refetch()} />}
      {machines.data && machines.data.length === 0 && <EmptyState label="No assets registered." />}

      {machines.data && machines.data.length > 0 && (
        <>
          <div>
            <div className="label-xs mb-2">Assets</div>
            <MachineChips machines={machines.data} selected={machineId} onSelect={(id) => select(id)} />
          </div>

          {machine.isPending && <Loading label="Loading twin…" />}
          {machine.isError && <ErrorState error={machine.error} onRetry={() => machine.refetch()} />}

          {machine.data && (
            <div className={zoomedFrom ? 'animate-fade-up' : undefined}>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Health" value={num(health, 0)} severity={healthSeverity(health)} hint="0–100" />
                <Stat
                  label="Risk"
                  value={num(risk, 0)}
                  severity={risk > 60 ? 'crit' : risk > 30 ? 'warn' : 'ok'}
                  hint="0–100"
                />
                <Stat label="Anomaly" value={num(anomaly, 1)} severity={anomalySeverity(anomaly)} hint="Correlation engine" />
                <Stat label="Status" value={status} severity={severityOf(status)} hint={machine.data.simulation_profile} />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <Panel
                  className="lg:col-span-2"
                  title="Asset profile"
                  subtitle={`${machine.data.category} · ${num(machine.data.operating_hours, 0)} operating hours`}
                  right={<Badge severity={severityOf(status)}>{machine.data.simulation_profile}</Badge>}
                >
                  <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="label-xs">Machine ID</dt>
                      <dd className="tnum mt-1 text-ink">{machine.data.machine_id}</dd>
                    </div>
                    <div>
                      <dt className="label-xs">Category</dt>
                      <dd className="mt-1 truncate text-ink">{machine.data.category}</dd>
                    </div>
                    <div>
                      <dt className="label-xs">Spindle / shaft</dt>
                      <dd className="tnum mt-1 text-ink">{num(machine.data.rpm, 0)} rpm</dd>
                    </div>
                    <div>
                      <dt className="label-xs">Operating hours</dt>
                      <dd className="tnum mt-1 text-ink">{num(machine.data.operating_hours, 0)} h</dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    <div className="label-xs mb-2 flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5" /> Sensors ({machine.data.sensors.length})
                    </div>
                    {machine.data.sensors.length === 0 ? (
                      <EmptyState label="No sensors bound to this asset." />
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {machine.data.sensors.map((s) => (
                          <div
                            key={s.sensor_id}
                            className="flex items-center gap-2.5 rounded-ctl border border-hairline bg-raised px-3 py-2"
                          >
                            <StatusDot severity={s.is_healthy ? 'ok' : 'crit'} />
                            <div className="min-w-0 flex-1">
                              <div className="tnum truncate text-xs text-ink">{s.sensor_id}</div>
                              <div className="truncate text-[10px] uppercase tracking-wider text-muted">{s.sensor_type}</div>
                            </div>
                            <div className="tnum shrink-0 text-sm text-ink">
                              {num(s.last_value, 1)}
                              <span className="ml-1 text-[10px] text-muted">{s.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel
                  title="Components"
                  subtitle="Wear and health by sub-assembly"
                  right={<Cog className="h-4 w-4 text-muted" />}
                >
                  {machine.data.components.length === 0 ? (
                    <EmptyState label="No components modelled." />
                  ) : (
                    <div className="space-y-3.5">
                      {machine.data.components.map((c) => (
                        <div key={c.component_id}>
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs text-ink" title={c.name}>
                              {c.name}
                            </span>
                            <span className={`tnum text-xs ${severityText[healthSeverity(c.health_score)]}`}>
                              {num(c.health_score, 0)}%
                            </span>
                          </div>
                          <div className="mt-1.5">
                            <Bar value={c.health_score} severity={healthSeverity(c.health_score)} />
                          </div>
                          <div className="mt-1 flex justify-between text-[10px] text-muted">
                            <span className="tnum">{c.component_type}</span>
                            <span className="tnum">wear {num(c.wear_percentage, 0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              {l && (
                <Panel className="mt-4" title="Live readings" subtitle="Streaming over the plant WebSocket">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <Stat label="Temperature" value={num(l.temperature)} unit="°C" severity={l.temperature > 85 ? 'crit' : l.temperature > 70 ? 'warn' : 'ok'} />
                    <Stat label="Vibration" value={num(l.vibration, 2)} unit="mm/s" severity={l.vibration > 4.5 ? 'crit' : l.vibration > 3.5 ? 'warn' : 'ok'} />
                    <Stat label="Current" value={num(l.current)} unit="A" severity="info" />
                    <Stat label="Gas" value={num(l.gas)} unit="ppm" severity={l.gas > 50 ? 'crit' : l.gas > 20 ? 'warn' : 'ok'} />
                    <Stat label="Anomaly" value={num(l.anomalyScore, 1)} severity={anomalySeverity(l.anomalyScore)} />
                  </div>
                </Panel>
              )}

              {!l && (
                <Panel className="mt-4" title="Live readings">
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted">
                    <Gauge className="h-4 w-4" /> Waiting for the first telemetry frame…
                  </div>
                </Panel>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

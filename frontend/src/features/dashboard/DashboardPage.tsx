import { Link } from 'react-router-dom'
import { Activity, Boxes, Cpu, HardDrive, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useHardwareProfile, useMachines, useSafetyStatus } from '@/hooks/useApi'
import { useAlertStore } from '@/store/alertStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useAuthStore } from '@/store/authStore'
import { anomalySeverity, healthSeverity, num, severityOf, severityText } from '@/lib/format'
import { Badge, Bar, EmptyState, ErrorState, Loading, PageHeader, Panel, Stat, StatusDot } from '@/components/ui'

export default function DashboardPage() {
  const canMachines = useAuthStore((s) => s.permissions.includes('machines:read'))
  const username = useAuthStore((s) => s.username)
  const select = useSelectionStore((s) => s.select)

  const safety = useSafetyStatus()
  const machines = useMachines(canMachines)
  const hardware = useHardwareProfile(canMachines)
  const live = useAlertStore((s) => s.live)
  const emergency = useAlertStore((s) => s.emergency)

  const state = emergency ? 'EMERGENCY' : (safety.data?.system_safety_state ?? 'NORMAL')

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Plant overview`}
        subtitle={`Signed in as ${username ?? '—'} · on-premise inference · zero external calls`}
        right={
          <Badge severity={severityOf(state)}>
            <StatusDot severity={severityOf(state)} pulse={state !== 'NORMAL'} /> {state}
          </Badge>
        }
      />

      {/* Safety summary */}
      {safety.isPending && <Loading label="Reading safety engine…" />}
      {safety.isError && <ErrorState error={safety.error} onRetry={() => safety.refetch()} />}
      {safety.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat
            label="Safety state"
            value={state}
            severity={severityOf(state)}
            hint="Deterministic engine"
          />
          <Stat
            label="Active interlocks"
            value={safety.data.active_interlocks}
            severity={safety.data.active_interlocks > 0 ? 'warn' : 'ok'}
          />
          <Stat
            label="Critical alerts"
            value={safety.data.critical_alerts}
            severity={safety.data.critical_alerts > 0 ? 'crit' : 'ok'}
          />
          <Stat
            label="Pending approvals"
            value={safety.data.pending_approvals}
            severity={safety.data.pending_approvals > 0 ? 'warn' : 'muted'}
            hint="Human-in-the-loop"
          />
          <Stat label="Safety rules" value={safety.data.safety_rules_count} severity="info" hint="Loaded interlocks" />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Fleet */}
        <Panel
          className="xl:col-span-2"
          title="Asset fleet"
          subtitle={machines.data ? `${machines.data.length} monitored assets` : undefined}
          right={
            <Link to="/god-view" className="btn btn-sm">
              <Boxes className="h-3.5 w-3.5" /> Plant floor
            </Link>
          }
          bodyClass="p-3 sm:p-4"
        >
          {!canMachines && <EmptyState label="Your role cannot read machine data." />}
          {canMachines && machines.isPending && <Loading label="Loading assets…" />}
          {canMachines && machines.isError && <ErrorState error={machines.error} onRetry={() => machines.refetch()} />}
          {canMachines && machines.data?.length === 0 && <EmptyState label="No assets registered." />}
          {canMachines && machines.data && machines.data.length > 0 && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {machines.data.map((m) => {
                const l = live[m.machine_id]
                const status = l?.status ?? m.status
                const health = l ? Math.max(0, 100 - l.anomalyScore * 0.8) : m.health_score
                const anomaly = l?.anomalyScore ?? m.anomaly_score
                return (
                  <Link
                    key={m.machine_id}
                    to="/digital-twin"
                    onClick={() => select(m.machine_id)}
                    className="rounded-ctl border border-hairline bg-raised p-3 transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot severity={severityOf(status)} pulse={severityOf(status) !== 'ok'} />
                      <span className="tnum text-sm font-medium text-ink">{m.machine_id}</span>
                      <span className={`ml-auto text-[11px] ${severityText[severityOf(status)]}`}>{status}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">{m.name}</p>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="label-xs">Health</div>
                        <div className={`tnum text-sm font-semibold ${severityText[healthSeverity(health)]}`}>
                          {num(health, 0)}
                        </div>
                      </div>
                      <div>
                        <div className="label-xs">Anomaly</div>
                        <div className={`tnum text-sm font-semibold ${severityText[anomalySeverity(anomaly)]}`}>
                          {num(anomaly, 1)}
                        </div>
                      </div>
                      <div>
                        <div className="label-xs">Temp</div>
                        <div className="tnum text-sm font-semibold text-ink">{l ? `${num(l.temperature)}°` : '—'}</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Bar value={health} severity={healthSeverity(health)} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          {/* Hardware */}
          <Panel title="Sovereign compute" subtitle="Auto-detected host capability">
            {hardware.isPending && <Loading label="Probing hardware…" />}
            {hardware.isError && <ErrorState error={hardware.error} onRetry={() => hardware.refetch()} />}
            {hardware.data && (
              <dl className="space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <Cpu className="h-3.5 w-3.5" /> CPU
                  </dt>
                  <dd className="tnum max-w-[60%] truncate text-right text-ink" title={hardware.data.cpu_model}>
                    {hardware.data.cpu_model}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <HardDrive className="h-3.5 w-3.5" /> RAM
                  </dt>
                  <dd className="tnum text-ink">
                    {num(hardware.data.available_ram_gb)} / {num(hardware.data.total_ram_gb)} GB
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">GPU</dt>
                  <dd className="tnum max-w-[60%] truncate text-right text-ink">{hardware.data.gpu_name}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Acceleration</dt>
                  <dd className="tnum text-ink">{hardware.data.acceleration}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Tier</dt>
                  <dd>
                    <Badge severity="info">{hardware.data.hardware_tier}</Badge>
                  </dd>
                </div>
              </dl>
            )}
          </Panel>

          <Panel title="Quick actions">
            <div className="grid gap-2">
              <Link to="/telemetry" className="btn justify-start">
                <Activity className="h-4 w-4" /> Live telemetry
              </Link>
              <Link to="/safety" className="btn justify-start">
                <ShieldCheck className="h-4 w-4" /> Safety &amp; interlocks
              </Link>
              <Link to="/ai-assistant" className="btn justify-start">
                <TriangleAlert className="h-4 w-4" /> Diagnose an anomaly
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Radio, RadioTower, Waves } from 'lucide-react'
import { useInjectScenario, useMachines } from '@/hooks/useApi'
import { useSelectionStore } from '@/store/selectionStore'
import { useAlertStore } from '@/store/alertStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSound } from '@/hooks/useSound'
import { useAuthStore } from '@/store/authStore'
import { telemetrySockets, type WsStatus } from '@/lib/wsManager'
import { ApiError } from '@/lib/apiClient'
import { WS_BASE } from '@/lib/env'
import { severityOf } from '@/lib/format'
import { pickDefaultMachine } from '@/lib/pickMachine'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel, StatusDot } from '@/components/ui'
import MachineChips from '@/components/MachineChips'
import TelemetryChart, { type ChartSpec } from './TelemetryChart'
import type { SimulationProfile } from '@/types/api'

const CHARTS: ChartSpec[] = [
  { key: 'temperature', label: 'Temperature', unit: '°C', color: '#f85149', threshold: 95 },
  { key: 'vibration', label: 'Vibration', unit: 'mm/s', color: '#f5a623', threshold: 4.5 },
  { key: 'current', label: 'Current', unit: 'A', color: '#22d3ee' },
  { key: 'gas', label: 'Gas', unit: 'ppm', color: '#3fb950', threshold: 50 },
  { key: 'anomaly_score', label: 'Anomaly score', unit: 'index', color: '#a371f7' },
]

const PROFILES: SimulationProfile[] = ['NORMAL', 'WARNING', 'CRITICAL', 'FAILURE', 'SENSOR_ANOMALY', 'STRESS']

const PROFILE_TONE: Record<SimulationProfile, string> = {
  NORMAL: 'hover:border-ok/60 hover:text-ok',
  WARNING: 'hover:border-warn/60 hover:text-warn',
  CRITICAL: 'hover:border-crit/60 hover:text-crit',
  FAILURE: 'hover:border-crit/60 hover:text-crit',
  SENSOR_ANOMALY: 'hover:border-info/60 hover:text-info',
  STRESS: 'hover:border-warn/60 hover:text-warn',
}

export default function TelemetryPage() {
  const machines = useMachines()
  const { machineId, select } = useSelectionStore()
  const history = useAlertStore((s) => (machineId ? s.history[machineId] : undefined))
  const perfMode = useSettingsStore((s) => s.perfMode)
  const canSimulate = useAuthStore((s) => s.permissions.includes('telemetry:simulate'))
  const { play } = useSound()

  const [wsStatus, setWsStatus] = useState<WsStatus>('closed')
  const [injectError, setInjectError] = useState<string | null>(null)
  const inject = useInjectScenario()

  useEffect(() => {
    if (!machineId) {
      const preferred = pickDefaultMachine(machines.data)
      if (preferred) select(preferred)
    }
  }, [machineId, machines.data, select])

  // The plant watch already owns the data stream; this subscription only
  // surfaces the connection state for the current machine.
  useEffect(() => {
    if (!machineId) return
    return telemetrySockets.subscribe(machineId, () => {}, setWsStatus)
  }, [machineId])

  const activeProfile = useMemo(
    () => machines.data?.find((m) => m.machine_id === machineId)?.simulation_profile,
    [machines.data, machineId],
  )

  const points = history ?? []

  const runScenario = async (profile: SimulationProfile) => {
    if (!machineId) return
    setInjectError(null)
    play('toggle')
    try {
      await inject.mutateAsync({ machine_id: machineId, profile })
    } catch (err) {
      play('denied')
      setInjectError(err instanceof ApiError ? err.detail : 'Scenario injection failed.')
    }
  }

  const wsSeverity = wsStatus === 'open' ? 'ok' : wsStatus === 'connecting' ? 'warn' : 'crit'

  return (
    <div className="space-y-4">
      <PageHeader
        title="Real-time telemetry"
        subtitle={
          machineId ? (
            <span className="tnum">
              {WS_BASE || 'same-origin'}/ws/telemetry/{machineId} · 1.5 s
            </span>
          ) : undefined
        }
        right={
          <Badge severity={wsSeverity}>
            <StatusDot severity={wsSeverity} pulse={wsStatus !== 'open'} />
            {wsStatus === 'open' ? 'LIVE' : wsStatus === 'connecting' ? 'CONNECTING' : 'RECONNECTING'}
          </Badge>
        }
      />

      {machines.isPending && <Loading label="Loading assets…" />}
      {machines.isError && <ErrorState error={machines.error} onRetry={() => machines.refetch()} />}

      {machines.data && machines.data.length > 0 && (
        <>
          <div>
            <div className="label-xs mb-2">Assets</div>
            <MachineChips machines={machines.data} selected={machineId} onSelect={(id) => select(id)} />
          </div>

          <Panel
            title={`Live traces — ${machineId ?? '—'}`}
            subtitle={points.length ? `${points.length} points in window` : 'Seeding from recorded history…'}
            right={
              <Badge severity="info">
                <Waves className="h-3 w-3" /> {perfMode === 'full' ? 'Full' : 'Lite'}
              </Badge>
            }
            bodyClass="p-3 sm:p-4"
          >
            {points.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Waiting for the first frames from the simulator…
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {CHARTS.map((spec) => (
                  <TelemetryChart key={spec.key} spec={spec} points={points} lite={perfMode === 'lite'} />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Inject scenario"
            subtitle="Switches the physics profile the simulator drives this asset with"
            right={
              activeProfile && (
                <Badge severity={severityOf(activeProfile)}>
                  <Radio className="h-3 w-3" /> {activeProfile}
                </Badge>
              )
            }
          >
            {!canSimulate ? (
              <EmptyState
                label="Scenario injection requires telemetry:simulate"
                hint="Operators and Safety Officers can watch the stream but cannot drive fault profiles."
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {PROFILES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void runScenario(p)}
                      disabled={inject.isPending || !machineId}
                      className={`chip ${activeProfile === p ? 'chip-active' : ''} ${PROFILE_TONE[p]} disabled:opacity-40`}
                    >
                      {inject.isPending && inject.variables?.profile === p ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RadioTower className="h-3 w-3" />
                      )}
                      {p}
                    </button>
                  ))}
                </div>

                {injectError && (
                  <p className="mt-3 rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{injectError}</p>
                )}
                {inject.data && !injectError && (
                  <p className="mt-3 rounded-ctl border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok">
                    {inject.data.machine_id} now running <span className="tnum">{inject.data.active_profile}</span> — first
                    frame at {inject.data.latest_telemetry.temperature.toFixed(1)} °C /{' '}
                    {inject.data.latest_telemetry.vibration.toFixed(2)} mm/s.
                  </p>
                )}
                <p className="mt-3 text-[11px] text-muted">
                  CRITICAL and FAILURE cross the interlock thresholds and will trip the war-room lockdown.
                </p>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}

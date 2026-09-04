import { useEffect, useState } from 'react'
import { FlaskConical, Loader2, RotateCcw } from 'lucide-react'
import { useMachines, useWhatIf } from '@/hooks/useApi'
import { useSelectionStore } from '@/store/selectionStore'
import { useSound } from '@/hooks/useSound'
import { ApiError } from '@/lib/apiClient'
import { num, severityOf } from '@/lib/format'
import { pickDefaultMachine } from '@/lib/pickMachine'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel, Stat } from '@/components/ui'
import MachineChips from '@/components/MachineChips'

interface Deltas {
  temp_delta: number
  vibration_delta: number
  current_delta: number
  gas_delta: number
  ambient_stress_multiplier: number
  simulation_steps: number
}

const DEFAULTS: Deltas = {
  temp_delta: 0,
  vibration_delta: 0,
  current_delta: 0,
  gas_delta: 0,
  ambient_stress_multiplier: 1,
  simulation_steps: 10,
}

const SLIDERS: Array<{ key: keyof Deltas; label: string; unit: string; min: number; max: number; step: number }> = [
  { key: 'temp_delta', label: 'Temperature delta', unit: '°C', min: -20, max: 60, step: 0.5 },
  { key: 'vibration_delta', label: 'Vibration delta', unit: 'mm/s', min: -2, max: 8, step: 0.1 },
  { key: 'current_delta', label: 'Current delta', unit: 'A', min: -20, max: 60, step: 0.5 },
  { key: 'gas_delta', label: 'Gas delta', unit: 'ppm', min: -5, max: 80, step: 0.5 },
  { key: 'ambient_stress_multiplier', label: 'Ambient stress', unit: '×', min: 0.5, max: 3, step: 0.05 },
  { key: 'simulation_steps', label: 'Projection steps', unit: 'steps', min: 1, max: 60, step: 1 },
]

/** Renders the live vs simulated state dictionaries side by side. */
function StateTable({ title, state, tone }: { title: string; state: Record<string, number | string>; tone: string }) {
  const entries = Object.entries(state)
  return (
    <div className="rounded-ctl border border-hairline bg-raised p-3">
      <div className={`label-xs mb-2 ${tone}`}>{title}</div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted">No state returned.</p>
      ) : (
        <dl className="space-y-1.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 text-xs">
              <dt className="truncate text-muted">{k.replace(/_/g, ' ')}</dt>
              <dd className="tnum shrink-0 text-ink">{typeof v === 'number' ? num(v, 2) : String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

export default function SimulationPage() {
  const machines = useMachines()
  const { machineId, select } = useSelectionStore()
  const [deltas, setDeltas] = useState<Deltas>(DEFAULTS)
  const [error, setError] = useState<string | null>(null)
  const { play } = useSound()
  const whatIf = useWhatIf()

  useEffect(() => {
    if (!machineId) {
      const preferred = pickDefaultMachine(machines.data)
      if (preferred) select(preferred)
    }
  }, [machineId, machines.data, select])

  const run = async () => {
    if (!machineId) return
    setError(null)
    play('toggle')
    try {
      await whatIf.mutateAsync({ machine_id: machineId, ...deltas })
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'Simulation failed.')
    }
  }

  const result = whatIf.data

  return (
    <div className="space-y-4">
      <PageHeader
        title="What-if simulation"
        subtitle="Isolated projection — never writes back to the live digital twin"
        right={
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setDeltas(DEFAULTS)
              play('click')
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
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

          <div className="grid gap-4 lg:grid-cols-5">
            <Panel className="lg:col-span-2" title="Scenario deltas" subtitle="Applied on top of the current live state">
              <div className="space-y-4">
                {SLIDERS.map((s) => (
                  <div key={s.key}>
                    <div className="flex items-baseline justify-between">
                      <label className="label-xs" htmlFor={s.key}>
                        {s.label}
                      </label>
                      <span className="tnum text-xs text-accent">
                        {num(deltas[s.key], s.step >= 1 ? 0 : 2)} {s.unit}
                      </span>
                    </div>
                    <input
                      id={s.key}
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={deltas[s.key]}
                      onChange={(e) => setDeltas((d) => ({ ...d, [s.key]: Number(e.target.value) }))}
                      className="mt-2 h-11 w-full cursor-pointer accent-[#f5a623]"
                    />
                  </div>
                ))}

                <button type="button" className="btn btn-primary w-full" onClick={() => void run()} disabled={whatIf.isPending || !machineId}>
                  {whatIf.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                  Run projection
                </button>

                {error && <p className="rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}
              </div>
            </Panel>

            <div className="space-y-4 lg:col-span-3">
              {!result && !whatIf.isPending && (
                <Panel title="Projection">
                  <EmptyState
                    label="No projection yet"
                    hint="Set the deltas and run the scenario to compare live and simulated state."
                    icon={<FlaskConical className="h-6 w-6" />}
                  />
                </Panel>
              )}

              {whatIf.isPending && (
                <Panel title="Projection">
                  <Loading label="Projecting scenario…" />
                </Panel>
              )}

              {result && (
                <>
                  <Panel
                    title="Predicted outcome"
                    subtitle={result.comparison_summary}
                    right={<Badge severity={severityOf(result.predicted_safety_state)}>{result.predicted_safety_state}</Badge>}
                  >
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Stat label="Health" value={num(result.predicted_health_score, 1)} severity={result.predicted_health_score < 60 ? 'crit' : result.predicted_health_score < 85 ? 'warn' : 'ok'} />
                      <Stat label="Risk" value={num(result.predicted_risk_score, 1)} severity={result.predicted_risk_score > 60 ? 'crit' : result.predicted_risk_score > 30 ? 'warn' : 'ok'} />
                      <Stat label="Anomaly" value={num(result.predicted_anomaly_score, 1)} severity={result.predicted_anomaly_score > 70 ? 'crit' : 'warn'} />
                      <Stat label="Safety state" value={result.predicted_safety_state} severity={severityOf(result.predicted_safety_state)} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <StateTable title="Live state" state={result.live_state} tone="text-info" />
                      <StateTable title="Simulated state" state={result.simulated_state} tone="text-accent" />
                    </div>
                  </Panel>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Panel title="Predicted safety violations">
                      {result.safety_violations_predicted.length === 0 ? (
                        <p className="text-xs text-ok">No interlock would be violated under this scenario.</p>
                      ) : (
                        <ul className="space-y-2">
                          {result.safety_violations_predicted.map((v) => (
                            <li key={v} className="rounded-ctl border border-crit/40 bg-crit/5 px-3 py-2 text-xs text-crit">
                              {v}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Panel>

                    <Panel title="Recommended actions">
                      {result.recommended_actions.length === 0 ? (
                        <p className="text-xs text-muted">No actions recommended.</p>
                      ) : (
                        <ul className="space-y-2">
                          {result.recommended_actions.map((a) => (
                            <li key={a} className="rounded-ctl border border-hairline bg-raised px-3 py-2 text-xs text-ink">
                              {a}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Panel>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  Info,
  RefreshCw,
  Sliders,
  Sparkles,
} from 'lucide-react'
import {
  useCompatibilityReport,
  useHardwareProfile,
  useModelRegistry,
  useModelRoutingTable,
  useRefreshModels,
  useSimulateModelRouting,
} from '@/hooks/useApi'
import { num } from '@/lib/format'
import { Badge, EmptyState, ErrorState, Loading, Panel, Stat } from '@/components/ui'
import type { ModelRoutingDecision } from '@/types/api'

const AVAILABLE_TASKS = [
  'GENERAL_LLM',
  'REASONING',
  'AGENT_PLANNER',
  'SOP_RAG',
  'DOCUMENT_ANALYSIS',
  'OCR',
  'EMBEDDING',
]

export default function HardwareTab() {
  const profile = useHardwareProfile()
  const models = useModelRegistry()
  const compatibility = useCompatibilityReport()
  const routingTable = useModelRoutingTable()
  const refreshModels = useRefreshModels()
  const simulateRouting = useSimulateModelRouting()

  // State for expanded explanation drawer in Routing Table
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  // State for Routing Simulator
  const [simTask, setSimTask] = useState<string>('REASONING')
  const [simRam, setSimRam] = useState<number>(8.0)
  const [simVram, setSimVram] = useState<number>(0.0)
  const [simHasGpu, setSimHasGpu] = useState<boolean>(false)
  const [simCpuCores, setSimCpuCores] = useState<number>(8)
  const [simResult, setSimResult] = useState<ModelRoutingDecision | null>(null)

  const handleRunSimulation = async () => {
    try {
      const res = await simulateRouting.mutateAsync({
        task: simTask,
        available_ram_gb: simRam,
        available_vram_gb: simVram,
        has_gpu: simHasGpu,
        cpu_cores: simCpuCores,
      })
      setSimResult(res)
    } catch (err) {
      console.error('Simulation error:', err)
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. Hardware Capability */}
      <Panel title="Hardware capability" subtitle="Detected host resources & safety execution budgets">
        {profile.isPending && <Loading label="Probing hardware…" />}
        {profile.isError && <ErrorState error={profile.error} onRetry={() => profile.refetch()} />}
        {profile.data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Hardware tier" value={profile.data.hardware_tier} severity="info" />
              <Stat label="Acceleration" value={profile.data.acceleration} severity={profile.data.has_dedicated_gpu ? 'ok' : 'muted'} />
              <Stat label="Total RAM" value={num(profile.data.total_ram_gb)} unit="GB" severity="muted" hint={`${num(profile.data.available_ram_gb)} GB free`} />
              <Stat label="Max safe model RAM" value={num(profile.data.max_safe_model_ram_gb)} unit="GB" severity="warn" hint="70% safety headroom limit" />
            </div>

            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['CPU model', profile.data.cpu_model],
                ['Cores', `${profile.data.physical_cores} physical / ${profile.data.logical_cores} logical`],
                ['GPU device', profile.data.gpu_name],
                ['GPU vendor', profile.data.gpu_vendor],
                ['Dedicated GPU', profile.data.has_dedicated_gpu ? 'yes' : 'no'],
                ['VRAM total', `${num(profile.data.gpu_memory_mb, 0)} MB`],
                ['Operating system', profile.data.operating_system],
              ].map(([k, v]) => (
                <div key={k} className="rounded-ctl border border-hairline bg-raised px-3 py-2">
                  <dt className="label-xs">{k}</dt>
                  <dd className="tnum mt-1 truncate text-ink" title={String(v)}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Panel>

      {/* 2. Live Model Routing Matrix */}
      <Panel
        title="Live model routing matrix"
        subtitle="Hardware-aware gateway routing every task to optimal local models"
        right={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">Strategy: <span className="font-mono text-ink">BALANCED</span></span>
            <Badge severity="ok">AUTONOMOUS</Badge>
          </div>
        }
        bodyClass="p-0"
      >
        {routingTable.isPending && <Loading label="Calculating optimal task routing…" />}
        {routingTable.isError && <ErrorState error={routingTable.error} onRetry={() => routingTable.refetch()} />}
        {routingTable.data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline bg-raised/40">
                  <th className="label-xs px-4 py-2.5">AI Task</th>
                  <th className="label-xs px-4 py-2.5">Selected Model</th>
                  <th className="label-xs px-4 py-2.5">Execution Target</th>
                  <th className="label-xs px-4 py-2.5">RAM Budget</th>
                  <th className="label-xs px-4 py-2.5">Score</th>
                  <th className="label-xs px-4 py-2.5 text-right">Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(routingTable.data.routing_table).map(([task, decision]) => {
                  const isExpanded = expandedTask === task
                  return (
                    <tr key={task} className="border-b border-hairline/60 last:border-0 hover:bg-raised/30 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-ink flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-info" />
                          {task}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-mono text-ink text-xs">{decision.selected_model_name || decision.selected_model_id}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {decision.is_fallback ? (
                            <Badge severity="warn">NATIVE FALLBACK</Badge>
                          ) : (
                            <Badge severity="ok">LOCAL GGUF</Badge>
                          )}
                          <span className="text-[10px] text-muted font-mono">{decision.selected_model_id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1 text-muted">
                          <Cpu className="h-3 w-3" />
                          <span>{decision.target_hardware || decision.execution_mode}</span>
                        </div>
                        <span className="text-[10px] text-muted block mt-0.5">Mode: {decision.execution_mode}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="tnum text-ink">{num(decision.resource_budget?.model_ram_required_gb ?? 0)} GB req</div>
                        <div className="text-[10px] text-muted">
                          Headroom: {num(decision.resource_budget?.ram_safety_headroom_gb ?? 0)} GB
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="font-mono font-semibold text-ink">{decision.score.toFixed(1)}</span>
                        <span className="text-[10px] text-muted"> / 100</span>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <button
                          type="button"
                          onClick={() => setExpandedTask(isExpanded ? null : task)}
                          className="btn btn-sm inline-flex items-center gap-1 text-xs"
                        >
                          <Info className="h-3 w-3" />
                          <span>{isExpanded ? 'Hide' : 'Explain'}</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Explanation Drawer when a task is clicked */}
            {expandedTask && routingTable.data.routing_table[expandedTask] && (
              <div className="p-4 bg-surface border-t border-hairline space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-ink text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-ok" />
                    Why was this model routed for <span className="font-mono text-info">{expandedTask}</span>?
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedTask(null)}
                    className="text-xs text-muted hover:text-ink"
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-ctl border border-hairline bg-raised p-3">
                    <div className="label-xs mb-1.5">Decision Rationale</div>
                    <ul className="space-y-1 text-xs text-muted">
                      {routingTable.data.routing_table[expandedTask].reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-info font-bold">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-ctl border border-hairline bg-raised p-3">
                    <div className="label-xs mb-1.5">Safety & Hardware Budget</div>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-[10px] text-muted">Max Safe RAM</dt>
                        <dd className="font-mono text-ink">{num(routingTable.data.routing_table[expandedTask].resource_budget?.max_safe_ram_gb ?? 0)} GB</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] text-muted">Model Required</dt>
                        <dd className="font-mono text-ink">{num(routingTable.data.routing_table[expandedTask].resource_budget?.model_ram_required_gb ?? 0)} GB</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] text-muted">Safety Headroom</dt>
                        <dd className="font-mono text-ink">{num(routingTable.data.routing_table[expandedTask].resource_budget?.ram_safety_headroom_gb ?? 0)} GB</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] text-muted">RAM Ceiling</dt>
                        <dd className="font-mono text-ink">{((routingTable.data.routing_table[expandedTask].resource_budget?.max_ram_utilization_limit ?? 0.7) * 100).toFixed(0)}%</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {routingTable.data.routing_table[expandedTask].candidates_evaluated?.length > 0 && (
                  <div className="mt-2">
                    <div className="label-xs mb-1.5">Evaluated Candidates Comparison</div>
                    <div className="overflow-x-auto rounded-ctl border border-hairline">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-hairline bg-raised/70">
                            <th className="px-3 py-1.5 text-muted">Candidate</th>
                            <th className="px-3 py-1.5 text-muted">RAM req</th>
                            <th className="px-3 py-1.5 text-muted">Score</th>
                            <th className="px-3 py-1.5 text-muted">Feasible?</th>
                            <th className="px-3 py-1.5 text-muted">Evaluation Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {routingTable.data.routing_table[expandedTask].candidates_evaluated.map((c) => (
                            <tr key={c.model_id} className="border-b border-hairline/40 last:border-0 hover:bg-raised/40">
                              <td className="px-3 py-1.5 font-mono text-ink">{c.name || c.model_id}</td>
                              <td className="px-3 py-1.5 text-muted">{num(c.ram_required_gb ?? 0)} GB</td>
                              <td className="px-3 py-1.5 font-mono text-ink">{c.score.toFixed(1)}</td>
                              <td className="px-3 py-1.5">
                                <Badge severity={c.is_feasible ? 'ok' : 'crit'}>
                                  {c.is_feasible ? 'FEASIBLE' : 'DISQUALIFIED'}
                                </Badge>
                              </td>
                              <td className="px-3 py-1.5 text-muted truncate max-w-xs">{c.reason || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* 3. Model Registry & Local GGUF Discovery */}
      <Panel
        title="Model registry & local discovery"
        subtitle="Discovered local .gguf models with runtime specs and compatibility"
        right={
          <button
            type="button"
            className="btn btn-sm inline-flex items-center gap-1.5"
            onClick={() => void refreshModels.mutate()}
            disabled={refreshModels.isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshModels.isPending ? 'animate-spin' : ''}`} />
            <span>{refreshModels.isPending ? 'Rescanning…' : 'Rescan Models Directory'}</span>
          </button>
        }
        bodyClass="p-0"
      >
        {models.isPending && <Loading label="Evaluating models…" />}
        {models.isError && <ErrorState error={models.error} onRetry={() => models.refetch()} />}
        {models.data?.length === 0 && <EmptyState label="No models found in the models directory." />}
        {models.data && models.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline bg-raised/40">
                  <th className="label-xs px-4 py-2.5">Model</th>
                  <th className="label-xs px-4 py-2.5">Source / Status</th>
                  <th className="label-xs px-4 py-2.5">Params</th>
                  <th className="label-xs px-4 py-2.5">Quant</th>
                  <th className="label-xs px-4 py-2.5">RAM Req</th>
                  <th className="label-xs px-4 py-2.5">Size on Disk</th>
                  <th className="label-xs px-4 py-2.5 text-right">Compatibility</th>
                </tr>
              </thead>
              <tbody>
                {models.data.map((m) => (
                  <tr key={m.model_id} className="border-b border-hairline/60 last:border-0 hover:bg-raised/60">
                    <td className="px-4 py-3">
                      <div className="tnum font-semibold text-ink">{m.model_id}</div>
                      <div className="truncate text-[10px] text-muted max-w-xs" title={m.description}>
                        {m.description}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.is_installed ? (
                        <span className="inline-flex items-center gap-1 text-ok text-[11px]">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Installed GGUF
                        </span>
                      ) : m.is_fallback ? (
                        <span className="inline-flex items-center gap-1 text-warn text-[11px]">
                          <Sparkles className="h-3.5 w-3.5" /> Native Reasoner
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted text-[11px]">
                          <HardDrive className="h-3.5 w-3.5" /> Catalog Spec
                        </span>
                      )}
                    </td>
                    <td className="tnum px-4 py-3 text-muted">{m.parameters}</td>
                    <td className="tnum px-4 py-3 text-muted">{m.quantization}</td>
                    <td className="tnum px-4 py-3 text-muted">{num(m.ram_required_gb)} GB</td>
                    <td className="tnum px-4 py-3 text-muted">
                      {m.file_size_gb ? `${num(m.file_size_gb)} GB` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge severity={m.is_compatible ? 'ok' : 'crit'}>
                        {m.is_compatible ? 'RUNS LOCALLY' : m.vram_required_gb && m.vram_required_gb > 0 ? 'NEEDS GPU' : 'EXCEEDS RAM'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* 4. Interactive Routing Simulator */}
      <Panel
        title="Hardware routing simulator"
        subtitle="Simulate how the gateway routes requests under different memory and hardware conditions"
        right={<Sliders className="h-4 w-4 text-muted" />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* Controls */}
          <div className="space-y-3 rounded-ctl border border-hairline bg-raised p-4">
            <div className="font-semibold text-xs text-ink uppercase tracking-wider">Simulation Parameters</div>
            <div className="space-y-2">
              <div>
                <label className="label-xs block mb-1">Target Task</label>
                <select
                  value={simTask}
                  onChange={(e) => setSimTask(e.target.value)}
                  className="field w-full text-xs"
                >
                  {AVAILABLE_TASKS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label-xs block mb-1">Free RAM (GB): {simRam.toFixed(1)} GB</label>
                  <input
                    type="range"
                    min="2"
                    max="64"
                    step="1"
                    value={simRam}
                    onChange={(e) => setSimRam(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="label-xs block mb-1">Free VRAM (GB): {simVram.toFixed(1)} GB</label>
                  <input
                    type="range"
                    min="0"
                    max="32"
                    step="1"
                    value={simVram}
                    onChange={(e) => setSimVram(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simHasGpu}
                    onChange={(e) => setSimHasGpu(e.target.checked)}
                    className="rounded border-hairline"
                  />
                  <span>Dedicated GPU Available</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="label-xs">CPU Cores:</span>
                  <input
                    type="number"
                    min="1"
                    max="64"
                    value={simCpuCores}
                    onChange={(e) => setSimCpuCores(parseInt(e.target.value) || 4)}
                    className="field w-16 text-xs text-center"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleRunSimulation()}
                disabled={simulateRouting.isPending}
                className="btn btn-sm w-full mt-2 font-medium"
              >
                {simulateRouting.isPending ? 'Simulating…' : 'Run Routing Simulation'}
              </button>
            </div>
          </div>

          {/* Simulation Output */}
          <div className="rounded-ctl border border-hairline bg-surface p-4 flex flex-col justify-between">
            <div>
              <div className="font-semibold text-xs text-ink uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Simulated Routing Decision</span>
                {simResult && (
                  <Badge severity={simResult.is_fallback ? 'warn' : 'ok'}>
                    {simResult.is_fallback ? 'FALLBACK TRIGGERED' : 'OPTIMAL MATCH'}
                  </Badge>
                )}
              </div>

              {simResult ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-ctl bg-raised border border-hairline">
                    <div className="text-xs text-muted">Routed Model:</div>
                    <div className="text-base font-bold text-ink font-mono mt-0.5">
                      {simResult.selected_model_name}
                    </div>
                    <div className="text-[11px] text-muted mt-1 flex flex-wrap gap-2">
                      <span>Execution: <strong className="text-ink">{simResult.execution_mode}</strong></span>
                      <span>Hardware: <strong className="text-ink">{simResult.target_hardware}</strong></span>
                      <span>Score: <strong className="text-ok font-mono">{simResult.score.toFixed(1)}/100</strong></span>
                    </div>
                  </div>

                  <div>
                    <div className="label-xs mb-1">Router Decision Logic:</div>
                    <ul className="text-xs text-muted space-y-1">
                      {simResult.reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-ok shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted py-8 text-center flex flex-col items-center justify-center gap-1">
                  <Sliders className="h-6 w-6 text-muted/50 mb-1" />
                  <span>Adjust the memory/hardware sliders and click <strong>Run Routing Simulation</strong> to test decision paths.</span>
                </div>
              )}
            </div>

            {simResult && (
              <div className="pt-2 border-t border-hairline text-[10px] text-muted flex justify-between">
                <span>Evaluated {simResult.candidates_evaluated.length} candidates</span>
                <span>Max Safe RAM: {num(simResult.resource_budget.max_safe_ram_gb)} GB</span>
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* 5. Compatibility Evaluation */}
      <Panel title="Compatibility evaluation" subtitle="Per-model resource reasoning from the hardware checker">
        {compatibility.isPending && <Loading label="Loading report…" />}
        {compatibility.isError && <ErrorState error={compatibility.error} onRetry={() => compatibility.refetch()} />}
        {compatibility.data && compatibility.data.model_evaluations.length === 0 && <EmptyState label="No evaluations returned." />}
        {compatibility.data && compatibility.data.model_evaluations.length > 0 && (
          <ul className="space-y-2">
            {compatibility.data.model_evaluations.map((ev) => (
              <li
                key={ev.model_id}
                className={`rounded-ctl border px-3 py-2 text-xs ${
                  ev.is_compatible ? 'border-ok/35 bg-ok/5' : 'border-hairline bg-raised'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tnum font-mono text-ink">{ev.model_id}</span>
                  <Badge severity={ev.is_compatible ? 'ok' : 'muted'}>{ev.is_compatible ? 'RUNS HERE' : 'BLOCKED'}</Badge>
                </div>
                {ev.reason && <p className="mt-1 text-[11px] text-muted">{ev.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

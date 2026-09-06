import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  BrainCircuit,
  CircuitBoard,
  FileText,
  Loader2,
  Send,
  User,
  Workflow,
  ShieldAlert,
  Clock,
  Layers,
  AlertTriangle,
  Cpu,
} from 'lucide-react'

import { api, ApiError } from '@/lib/apiClient'
import { useMachines, useCapabilities, useActiveModelStatus } from '@/hooks/useApi'
import { useSelectionStore } from '@/store/selectionStore'
import { useAuthStore } from '@/store/authStore'
import { useSound } from '@/hooks/useSound'
import { num, severityOf } from '@/lib/format'
import { pickDefaultMachine } from '@/lib/pickMachine'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel } from '@/components/ui'
import Markdown from '@/components/Markdown'
import MachineChips from '@/components/MachineChips'
import type {
  AIChatResponse,
  OrchestratorExecuteResponse,
  OrchestratorPlanResponse
} from '@/types/api'

interface Turn {
  id: string
  role: 'user' | 'assistant'
  text: string
  payload?: AIChatResponse
  orchPayload?: OrchestratorExecuteResponse
  planPayload?: OrchestratorPlanResponse
  mode?: 'chat' | 'agent' | 'orchestrator' | 'plan_preview'
}

export default function AIAssistantPage() {
  const machines = useMachines()
  const capabilities = useCapabilities()
  const activeModel = useActiveModelStatus()
  const { machineId, select } = useSelectionStore()
  const canAgent = useAuthStore((s) => s.permissions.includes('agent:execute'))
  const { play } = useSound()

  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [useRag, setUseRag] = useState(true)
  const [useGraph, setUseGraph] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCaps, setShowCaps] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!machineId) {
      const preferred = pickDefaultMachine(machines.data)
      if (preferred) select(preferred)
    }
  }, [machineId, machines.data, select])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  const send = async (mode: 'chat' | 'agent' | 'orchestrator') => {
    const message = input.trim()
    if (!message || busy) return

    setError(null)
    setBusy(true)
    setInput('')
    play('click')
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: 'user', text: message }])

    try {
      if (mode === 'orchestrator') {
        const res = await api.post<OrchestratorExecuteResponse>('/api/orchestrator/execute', {
          prompt: message,
          machine_id: machineId,
          auto_approve_controlled: false,
        })
        setTurns((t) => [
          ...t,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: res.final_answer || (res.status === 'PAUSED_FOR_APPROVAL' ? '⚠️ Execution paused pending Safety Officer approval.' : 'Workflow completed.'),
            orchPayload: res,
            mode,
          },
        ])
        play(res.status === 'PAUSED_FOR_APPROVAL' ? 'denied' : 'click')
      } else {
        const endpoint = mode === 'agent' ? '/api/ai/agent/execute' : '/api/ai/chat'
        const res = await api.post<AIChatResponse>(endpoint, {
          message,
          machine_id: machineId,
          use_rag: useRag,
          use_graphrag: useGraph,
        })
        setTurns((t) => [...t, { id: `a-${Date.now()}`, role: 'assistant', text: res.response, payload: res, mode }])
        play(res.safety_check === 'PASSED' ? 'click' : 'denied')
      }
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'The assistant could not complete the request.')
    } finally {
      setBusy(false)
    }
  }

  const previewPlan = async () => {
    const message = input.trim()
    if (!message || busy) return

    setError(null)
    setBusy(true)
    setInput('')
    play('click')
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: 'user', text: `[Plan Preview]: ${message}` }])

    try {
      const res = await api.post<OrchestratorPlanResponse>('/api/orchestrator/plan', {
        prompt: message,
        machine_id: machineId,
      })
      setTurns((t) => [
        ...t,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: `Proposed multi-step workflow plan for intent **${res.detected_intent}** (${(res.confidence * 100).toFixed(1)}% confidence, level: \`${res.planning_level}\`):`,
          planPayload: res,
          mode: 'plan_preview',
        },
      ])
      play('click')
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'Could not formulate orchestrator plan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Assistant & Sovereign Orchestrator"
        subtitle="Dense vector intent analysis, multi-step agentic planning, sandboxed tool execution & air-gapped inference"
        right={
          <>
            <div
              className="flex items-center gap-1.5 rounded-full border border-hairline bg-raised/80 px-2.5 py-1 text-xs"
              title={
                activeModel.data?.llama_cpp_installed
                  ? `Active Engine: ${activeModel.data?.active_model_name} (Runtime: llama_cpp ${activeModel.data?.llama_cpp_version || 'ready'})`
                  : `Active Engine: ${activeModel.data?.active_model_name} (Notice: llama-cpp-python not loaded, using Native Industrial Reasoner fallback)`
              }
            >
              <span className={`h-2 w-2 rounded-full ${activeModel.data?.is_fallback ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              <Cpu className="h-3 w-3 text-muted" />
              <span className="font-medium text-ink max-w-[170px] truncate">
                {activeModel.data?.active_model_name || 'Loading Engine...'}
              </span>
            </div>
            <button
              type="button"
              className={`chip ${showCaps ? 'chip-active bg-accent/20 text-accent' : ''}`}
              onClick={() => {
                setShowCaps((v) => !v)
                play('click')
              }}
              title="Inspect 14 sovereign industrial capabilities"
            >
              <Cpu className="h-3 w-3" /> Capabilities ({capabilities.data?.total ?? 14})
            </button>
            <button
              type="button"
              className={`chip ${useRag ? 'chip-active' : ''}`}
              onClick={() => {
                setUseRag((v) => !v)
                play('click')
              }}
            >
              <FileText className="h-3 w-3" /> RAG
            </button>
            <button
              type="button"
              className={`chip ${useGraph ? 'chip-active' : ''}`}
              onClick={() => {
                setUseGraph((v) => !v)
                play('click')
              }}
            >
              <CircuitBoard className="h-3 w-3" /> GraphRAG
            </button>
          </>
        }
      />

      {/* Capabilities Drawer Modal */}
      {showCaps && (
        <Panel title="Sovereign Capability Registry (Air-Gapped & Local)" className="border-accent/40 bg-card/95">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
            {capabilities.data?.capabilities.map((cap) => (
              <div key={cap.id} className="rounded-card border border-hairline bg-raised p-2.5 text-xs">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-medium text-ink">{cap.name}</span>
                  <Badge severity={cap.is_controlled ? 'warn' : 'info'}>
                    {cap.type}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted mb-2">{cap.description}</p>
                <div className="flex flex-wrap gap-1">
                  {cap.examples.slice(0, 2).map((ex, i) => (
                    <span key={i} className="rounded bg-base px-1.5 py-0.5 text-[10px] text-muted">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {machines.isPending && <Loading label="Loading assets…" />}
      {machines.isError && <ErrorState error={machines.error} onRetry={() => machines.refetch()} />}
      {machines.data && machines.data.length > 0 && (
        <div>
          <div className="label-xs mb-2">Machine context</div>
          <MachineChips machines={machines.data} selected={machineId} onSelect={(id) => select(id)} />
        </div>
      )}

      <Panel bodyClass="p-0" className="overflow-hidden">
        <div ref={scrollRef} className="max-h-[54vh] min-h-[320px] overflow-y-auto p-3 sm:p-4">
          {turns.length === 0 && (
            <EmptyState
              icon={<BrainCircuit className="h-6 w-6 text-accent" />}
              label="Sovereign Orchestrator Ready"
              hint={
                machineId
                  ? `Try: "Why is ${machineId} vibrating?", "Extract inspection sheet and evaluate bearing wear", or "Calculate remaining bearing life".`
                  : 'Select a machine or ask an engineering question to engage the Orchestrator Brain.'
              }
            />
          )}

          <div className="space-y-4">
            {turns.map((turn) =>
              turn.role === 'user' ? (
                <div key={turn.id} className="flex justify-end gap-2">
                  <div className="max-w-[85%] rounded-card rounded-tr-sm border border-hairline bg-raised px-3.5 py-2.5 text-sm text-ink">
                    {turn.text}
                  </div>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-raised">
                    <User className="h-3.5 w-3.5 text-muted" />
                  </div>
                </div>
              ) : (
                <div key={turn.id} className="flex gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
                    <Bot className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <div className="min-w-0 max-w-[92%] flex-1 space-y-3">
                    {/* Header Badges */}
                    <div className="rounded-card rounded-tl-sm border border-hairline bg-[#0b0e13] px-3.5 py-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {turn.mode === 'orchestrator' && (
                          <>
                            <Badge severity="info">
                              <BrainCircuit className="h-3 w-3 inline mr-1" />
                              Orchestrator: {turn.orchPayload?.detected_intent}
                            </Badge>
                            <Badge severity={turn.orchPayload?.is_fallback ? 'warn' : 'ok'}>
                              <Cpu className="h-3 w-3 inline mr-1" />
                              model: {turn.orchPayload?.model_used || 'Native Reasoner'}
                            </Badge>
                            <Badge severity="muted">
                              {turn.orchPayload?.planning_level}
                            </Badge>

                            <Badge severity="ok">
                              {(Number(turn.orchPayload?.confidence || 0) * 100).toFixed(0)}% conf
                            </Badge>
                            <Badge severity="info">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {turn.orchPayload?.total_time_ms} ms
                            </Badge>
                            <Badge severity={severityOf(turn.orchPayload?.safety_check || 'PASSED')}>
                              safety: {turn.orchPayload?.safety_check || 'PASSED'}
                            </Badge>
                          </>
                        )}
                        {turn.mode === 'chat' && (
                          <Badge severity="info">model: {turn.payload?.model_used ?? 'local'}</Badge>
                        )}
                        {turn.mode === 'agent' && (
                          <Badge severity="warn">
                            <Workflow className="h-3 w-3 inline mr-1" /> agent
                          </Badge>
                        )}
                        {turn.mode === 'plan_preview' && (
                          <Badge severity="info">
                            <Layers className="h-3 w-3 inline mr-1" /> Plan Preview
                          </Badge>
                        )}

                      </div>

                      {/* Controlled Action Gate Warning Banner */}
                      {turn.orchPayload?.status === 'PAUSED_FOR_APPROVAL' && turn.orchPayload.pending_approval && (
                        <div className="mb-3 rounded border border-warn/50 bg-warn/10 p-2.5 text-xs text-warn flex items-start gap-2">
                          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">HUMAN-IN-THE-LOOP CHECKPOINT:</span> Autonomous execution paused.
                            Action <code className="text-ink bg-black/40 px-1 rounded">{String(turn.orchPayload.pending_approval.action_type)}</code> on <code className="text-ink bg-black/40 px-1 rounded">{String(turn.orchPayload.pending_approval.target_resource)}</code> requires Safety Officer approval.
                            <div className="mt-1 text-[11px] text-muted">Request ID: <span className="text-ink font-mono">{String(turn.orchPayload.pending_approval.request_id)}</span></div>
                          </div>
                        </div>
                      )}

                      <Markdown>{turn.text}</Markdown>
                    </div>

                    {/* Proposed Plan Preview Steps */}
                    {turn.planPayload && turn.planPayload.steps.length > 0 && (
                      <div className="rounded-ctl border border-hairline bg-card p-3">
                        <div className="label-xs mb-2 flex items-center justify-between">
                          <span>Workflow Decomposition ({turn.planPayload.total_steps} steps)</span>
                          <span className="text-[10px] text-accent">{turn.planPayload.planning_level}</span>
                        </div>
                        <ol className="space-y-2">
                          {turn.planPayload.steps.map((s) => (
                            <li key={s.step_number} className="flex items-start gap-2 text-xs">
                              <span className="mt-0.5 h-4 w-4 shrink-0 rounded bg-accent/10 border border-accent/30 text-accent flex items-center justify-center text-[10px]">
                                {s.step_number}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-ink">{s.action}</span>
                                  <Badge severity={s.handler_type === 'TOOL' ? 'info' : 'ok'}>
                                    {s.tool_or_model || s.handler_type}
                                  </Badge>
                                </div>
                                {s.requires_approval && (
                                  <span className="text-[10px] text-warn flex items-center gap-1 mt-0.5">
                                    <AlertTriangle className="h-2.5 w-2.5" /> Requires Human-in-the-Loop Sign-off
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Orchestrator Live Execution Trace */}
                    {turn.orchPayload && turn.orchPayload.execution_trace.length > 0 && (
                      <div className="rounded-ctl border border-hairline bg-card p-3">
                        <div className="label-xs mb-2 flex items-center justify-between">
                          <span>Execution Trace & Audited Steps</span>
                          <span className="text-[10px] text-muted">Data isolation: Sandboxed</span>
                        </div>
                        <ol className="space-y-2.5">
                          {turn.orchPayload.execution_trace.map((s) => (
                            <li key={s.step_number} className="flex items-start gap-2.5 text-xs">
                              <span
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                  s.status === 'WAITING_APPROVAL' ? 'bg-warn' : s.status === 'WARNING' ? 'bg-warn' : 'bg-ok'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="font-medium text-ink">
                                    {s.step_number}. {s.action}
                                  </span>
                                  <span className="tnum ml-auto text-[10px] text-accent">
                                    {s.target} · {s.execution_time_ms}ms
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted">{s.output_summary}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Standard Citations */}
                    {turn.payload && turn.payload.citations.length > 0 && (
                      <div className="rounded-ctl border border-hairline bg-card p-3">
                        <div className="label-xs mb-2">Citations</div>
                        <ul className="space-y-1.5">
                          {turn.payload.citations.map((c, i) => (
                            <li key={`${c.doc_id}-${i}`} className="flex items-start gap-2 text-xs">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                              <span className="min-w-0 flex-1">
                                <span className="text-ink">{c.title}</span>
                                <span className="ml-1.5 tnum text-muted">
                                  p.{c.page_number} · {num(c.relevance_score, 2)}
                                </span>
                                <span className="mt-0.5 block truncate text-muted" title={c.snippet}>
                                  {c.snippet}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Sovereign Brain reasoning & executing local tools…
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-hairline p-3">
          {error && <p className="mb-2 rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="field flex-1"
              placeholder={machineId ? `Command or query for ${machineId} (e.g. diagnose bearing vibration)...` : 'Command or query Sovereign Orchestrator...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send('orchestrator')
                }
              }}
              disabled={busy}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary flex-1 sm:flex-none"
                onClick={() => void send('orchestrator')}
                disabled={busy || !input.trim()}
                title="Execute multi-step workflow with Sovereign Orchestrator brain"
              >
                <BrainCircuit className="h-4 w-4" /> Orchestrate
              </button>
              <button
                type="button"
                className="btn flex-1 sm:flex-none"
                onClick={() => void previewPlan()}
                disabled={busy || !input.trim()}
                title="Preview workflow decomposition without executing tools"
              >
                <Layers className="h-4 w-4" /> Preview Plan
              </button>
              <button
                type="button"
                className="btn flex-1 sm:flex-none"
                onClick={() => void send('agent')}
                disabled={busy || !input.trim() || !canAgent}
                title={canAgent ? 'Run legacy agent execution' : 'Requires agent:execute permission'}
              >
                <Workflow className="h-4 w-4" /> Agent
              </button>
              <button
                type="button"
                className="btn flex-1 sm:flex-none"
                onClick={() => void send('chat')}
                disabled={busy || !input.trim()}
                title="Ask a direct question"
              >
                <Send className="h-4 w-4" /> Ask
              </button>
            </div>
          </div>
          {!canAgent && (
            <p className="mt-1 text-[11px] text-muted">Agent execution requires the agent:execute permission.</p>
          )}

          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>Air-gapped & on-premise · 100% offline · Controlled actions require Safety Officer sign-off</span>
            <span className="font-mono text-[10px] text-accent">Sovereign Brain v2.0</span>
          </div>
        </div>
      </Panel>
    </div>
  )
}

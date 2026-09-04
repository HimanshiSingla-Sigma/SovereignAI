import { useEffect, useRef, useState } from 'react'
import { Bot, BrainCircuit, CircuitBoard, FileText, Loader2, Send, Sparkles, User, Workflow } from 'lucide-react'
import { api } from '@/lib/apiClient'
import { ApiError } from '@/lib/apiClient'
import { useMachines } from '@/hooks/useApi'
import { useSelectionStore } from '@/store/selectionStore'
import { useAuthStore } from '@/store/authStore'
import { useSound } from '@/hooks/useSound'
import { num, severityOf } from '@/lib/format'
import { pickDefaultMachine } from '@/lib/pickMachine'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel } from '@/components/ui'
import Markdown from '@/components/Markdown'
import MachineChips from '@/components/MachineChips'
import type { AIChatResponse } from '@/types/api'

interface Turn {
  id: string
  role: 'user' | 'assistant'
  text: string
  payload?: AIChatResponse
  mode?: 'chat' | 'agent'
}

export default function AIAssistantPage() {
  const machines = useMachines()
  const { machineId, select } = useSelectionStore()
  const canAgent = useAuthStore((s) => s.permissions.includes('agent:execute'))
  const { play } = useSound()

  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [useRag, setUseRag] = useState(true)
  const [useGraph, setUseGraph] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const send = async (mode: 'chat' | 'agent') => {
    const message = input.trim()
    if (!message || busy) return

    setError(null)
    setBusy(true)
    setInput('')
    play('click')
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: 'user', text: message }])

    try {
      const endpoint = mode === 'agent' ? '/api/ai/agent/execute' : '/api/ai/chat'
      const res = await api.post<AIChatResponse>(endpoint, {
        message,
        machine_id: machineId,
        use_rag: useRag,
        use_graphrag: useGraph,
      })
      setTurns((t) => [...t, { id: `a-${Date.now()}`, role: 'assistant', text: res.response, payload: res, mode }])
      play(res.safety_check === 'PASSED' ? 'click' : 'denied')
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'The assistant could not answer.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI assistant"
        subtitle="Grounded on local RAG, the knowledge graph and live telemetry — nothing leaves the plant"
        right={
          <>
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

      {machines.isPending && <Loading label="Loading assets…" />}
      {machines.isError && <ErrorState error={machines.error} onRetry={() => machines.refetch()} />}
      {machines.data && machines.data.length > 0 && (
        <div>
          <div className="label-xs mb-2">Machine context</div>
          <MachineChips machines={machines.data} selected={machineId} onSelect={(id) => select(id)} />
        </div>
      )}

      <Panel bodyClass="p-0" className="overflow-hidden">
        <div ref={scrollRef} className="max-h-[52vh] min-h-[320px] overflow-y-auto p-3 sm:p-4">
          {turns.length === 0 && (
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              label="Ask about an asset"
              hint={
                machineId
                  ? `For example: "Why is ${machineId} vibrating?" — answers cite the local manuals and the knowledge graph.`
                  : 'Select a machine for telemetry-grounded answers.'
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
                    <div className="rounded-card rounded-tl-sm border border-hairline bg-[#0b0e13] px-3.5 py-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge severity="info">model: {turn.payload?.model_used ?? 'local'}</Badge>
                        {turn.payload?.safety_check && (
                          <Badge severity={severityOf(turn.payload.safety_check)}>
                            safety_check: {turn.payload.safety_check}
                          </Badge>
                        )}
                        {turn.mode === 'agent' && (
                          <Badge severity="warn">
                            <Workflow className="h-3 w-3" /> agent
                          </Badge>
                        )}
                      </div>
                      <Markdown>{turn.text}</Markdown>
                    </div>

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

                    {turn.payload && turn.payload.knowledge_facts.length > 0 && (
                      <div className="rounded-ctl border border-hairline bg-card p-3">
                        <div className="label-xs mb-2">Knowledge graph facts</div>
                        <ul className="space-y-1.5">
                          {turn.payload.knowledge_facts.map((f, i) => (
                            <li key={i} className="tnum text-[11px] leading-relaxed text-muted">
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {turn.payload && turn.payload.agent_steps.length > 0 && (
                      <div className="rounded-ctl border border-hairline bg-card p-3">
                        <div className="label-xs mb-2">Agent steps</div>
                        <ol className="space-y-2">
                          {turn.payload.agent_steps.map((s) => (
                            <li key={s.step_number} className="flex items-start gap-2.5">
                              <span
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                  severityOf(s.status) === 'crit' ? 'bg-crit' : severityOf(s.status) === 'warn' ? 'bg-warn' : 'bg-ok'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="tnum text-xs text-ink">
                                    {s.step_number} · {s.action}
                                  </span>
                                  {s.tool_used && <span className="tnum ml-auto text-[10px] text-accent">{s.tool_used}</span>}
                                </div>
                                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{s.output_summary}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Local model reasoning…
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-hairline p-3">
          {error && <p className="mb-2 rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="field flex-1"
              placeholder={machineId ? `Ask about ${machineId}…` : 'Ask the assistant…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send('chat')
                }
              }}
              disabled={busy}
            />
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary flex-1 sm:flex-none" onClick={() => void send('chat')} disabled={busy || !input.trim()}>
                <Send className="h-4 w-4" /> Ask
              </button>
              <button
                type="button"
                className="btn flex-1 sm:flex-none"
                onClick={() => void send('agent')}
                disabled={busy || !input.trim() || !canAgent}
                title={canAgent ? 'Run the multi-step agent plan' : 'Requires agent:execute'}
              >
                <BrainCircuit className="h-4 w-4" /> Agent
              </button>
            </div>
          </div>
          {!canAgent && <p className="mt-2 text-[11px] text-muted">Agent execution requires the agent:execute permission.</p>}
        </div>
      </Panel>
    </div>
  )
}

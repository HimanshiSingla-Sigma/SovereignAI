import { useEffect, useMemo, useState } from 'react'
import { Network, Play, RotateCcw, Sparkles } from 'lucide-react'
import { useKnowledgeGraph, useMachines, useRootCause } from '@/hooks/useApi'
import { useSelectionStore } from '@/store/selectionStore'
import { useSound } from '@/hooks/useSound'
import { num } from '@/lib/format'
import { pickDefaultMachine } from '@/lib/pickMachine'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel, Stat } from '@/components/ui'
import MachineChips from '@/components/MachineChips'
import GraphCanvas from './GraphCanvas'
import { parseCausalChain } from './graphLayout'
import type { KnowledgeNode } from '@/types/api'

const STEP_MS = 850

export default function GraphRagPage() {
  const machines = useMachines()
  const { machineId, select } = useSelectionStore()
  const graph = useKnowledgeGraph()
  const { play } = useSound()

  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null)

  // Default to a machine the knowledge graph actually covers — picking an
  // asset with no edges makes the whole screen look broken even though the
  // empty state is correct. Coverage comes from the graph the backend returned.
  useEffect(() => {
    if (machineId) return
    const covered = new Set((graph.data?.edges ?? []).map((e) => e.source))
    const withCoverage = (machines.data ?? []).filter((m) => covered.has(m.machine_id))
    const preferred = pickDefaultMachine(withCoverage.length ? withCoverage : machines.data)
    if (preferred) select(preferred)
  }, [machineId, machines.data, graph.data, select])

  const rootCause = useRootCause(machineId)

  // Assets that appear as an edge source, i.e. the ones a traversal can start from.
  const coveredMachines = useMemo(() => {
    const covered = new Set((graph.data?.edges ?? []).map((e) => e.source))
    return (machines.data ?? []).filter((m) => covered.has(m.machine_id)).map((m) => m.machine_id)
  }, [graph.data, machines.data])

  // Hops are resolved from the backend's causal chain against the real graph.
  const chain = useMemo(() => {
    if (!rootCause.data || !graph.data) return []
    return parseCausalChain(rootCause.data.causal_chain, graph.data.nodes)
  }, [rootCause.data, graph.data])

  // Reset the traversal when the target machine changes.
  useEffect(() => {
    setStep(0)
    setPlaying(false)
  }, [machineId])

  useEffect(() => {
    if (!playing) return
    if (step >= chain.length) {
      setPlaying(false)
      return
    }
    const id = window.setTimeout(() => {
      setStep((s) => s + 1)
      play('click')
    }, STEP_MS)
    return () => window.clearTimeout(id)
  }, [playing, step, chain.length, play])

  const startTraversal = () => {
    if (chain.length === 0) return
    play('toggle')
    setStep(0)
    setPlaying(true)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="GraphRAG traversal"
        subtitle="Multi-hop causal reasoning over the sovereign knowledge graph"
        right={
          graph.data && (
            <Badge severity="info">
              <Network className="h-3 w-3" /> {graph.data.nodes.length} nodes · {graph.data.edges.length} edges
            </Badge>
          )
        }
      />

      {machines.data && machines.data.length > 0 && (
        <div>
          <div className="label-xs mb-2">Root-cause target</div>
          <MachineChips machines={machines.data} selected={machineId} onSelect={(id) => select(id)} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Knowledge graph"
          subtitle={
            chain.length
              ? `Traversal ${Math.min(step, chain.length)} / ${chain.length} hops`
              : 'Run a root-cause analysis to light the causal path'
          }
          right={
            <>
              <button
                type="button"
                className="btn btn-sm"
                onClick={startTraversal}
                disabled={chain.length === 0 || playing}
                title="Animate the causal chain the backend returned"
              >
                <Play className="h-3.5 w-3.5" /> Trace
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setStep(0)
                  setPlaying(false)
                  play('click')
                }}
                disabled={step === 0 && !playing}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </>
          }
          bodyClass="p-3 sm:p-4"
        >
          {graph.isPending && <Loading label="Loading knowledge graph…" />}
          {graph.isError && <ErrorState error={graph.error} onRetry={() => graph.refetch()} />}
          {graph.data && graph.data.nodes.length === 0 && <EmptyState label="The knowledge graph is empty." />}
          {graph.data && graph.data.nodes.length > 0 && (
            <>
              <GraphCanvas
                nodes={graph.data.nodes}
                edges={graph.data.edges}
                chain={chain}
                step={step}
                selectedId={selectedNode?.id ?? null}
                onSelectNode={(n) => {
                  play('click')
                  setSelectedNode(n)
                }}
              />

              {selectedNode && (
                <div className="mt-3 rounded-ctl border border-hairline bg-raised px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="tnum text-xs text-accent">{selectedNode.id}</span>
                    <Badge severity="muted">{selectedNode.type}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink">{selectedNode.name}</p>
                  {Object.keys(selectedNode.properties ?? {}).length > 0 && (
                    <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                      {Object.entries(selectedNode.properties).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 text-[11px]">
                          <dt className="text-muted">{k}</dt>
                          <dd className="tnum truncate text-ink">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}
            </>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Probable root cause" subtitle={machineId ?? undefined}>
            {rootCause.isPending && <Loading label="Traversing…" />}
            {rootCause.isError && <ErrorState error={rootCause.error} onRetry={() => rootCause.refetch()} />}
            {rootCause.data && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label="Confidence"
                    value={`${num(rootCause.data.confidence * 100, 0)}%`}
                    severity={rootCause.data.confidence > 0.8 ? 'crit' : 'warn'}
                  />
                  <Stat label="Historical" value={rootCause.data.historical_occurrences} unit="events" severity="info" />
                </div>

                <div className="mt-4">
                  <div className="label-xs mb-1.5">Cause</div>
                  <p className="text-sm leading-relaxed text-ink">{rootCause.data.probable_root_cause}</p>
                </div>

                <div className="mt-4">
                  <div className="label-xs mb-1.5">Recommended mitigation</div>
                  <p className="text-xs leading-relaxed text-muted">{rootCause.data.recommended_mitigation}</p>
                </div>
              </>
            )}
          </Panel>

          <Panel
            title="Causal chain"
            subtitle={chain.length ? `${chain.length} resolvable hops` : undefined}
            right={<Sparkles className="h-4 w-4 text-muted" />}
            bodyClass="p-3"
          >
            {!rootCause.data && <p className="px-1 text-xs text-muted">Select a machine to trace its causal chain.</p>}
            {rootCause.data && rootCause.data.causal_chain.length === 0 && (
              <EmptyState
                label="No causal path recorded for this asset"
                hint={
                  coveredMachines.length
                    ? `The knowledge graph has traversable relationships for ${coveredMachines.join(', ')}.`
                    : 'The knowledge graph has no relationships for any asset yet.'
                }
              />
            )}
            {rootCause.data && rootCause.data.causal_chain.length > 0 && (
              <ol className="space-y-1.5">
                {rootCause.data.causal_chain.map((entry, i) => {
                  const lit = i < step
                  return (
                    <li
                      key={`${entry}-${i}`}
                      className={`rounded-ctl border px-2.5 py-2 font-mono text-[10px] leading-relaxed transition-colors ${
                        lit ? 'border-crit/50 bg-crit/5 text-crit' : 'border-hairline bg-raised text-muted'
                      }`}
                    >
                      {entry}
                    </li>
                  )
                })}
              </ol>
            )}
            {rootCause.data && chain.length < rootCause.data.causal_chain.length && (
              <p className="mt-2 px-1 text-[10px] text-muted">
                {rootCause.data.causal_chain.length - chain.length} hop(s) reference entities outside the returned graph and
                are listed but not animated.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

import type { KnowledgeEdge, KnowledgeNode } from '@/types/api'

export interface Positioned {
  id: string
  x: number
  y: number
}

export interface ChainStep {
  sourceId: string
  targetId: string
  relation: string
}

/**
 * The backend renders each causal-chain hop as `Source --[REL]--> Target`
 * using node *names*. Parsing it back to node ids is what lets the animation
 * light up real edges instead of a hardcoded script.
 */
export function parseCausalChain(chain: string[], nodes: KnowledgeNode[]): ChainStep[] {
  const byName = new Map(nodes.map((n) => [n.name.trim().toLowerCase(), n.id]))
  const byId = new Map(nodes.map((n) => [n.id.trim().toLowerCase(), n.id]))

  const resolve = (label: string): string | null => {
    const key = label.trim().toLowerCase()
    return byName.get(key) ?? byId.get(key) ?? null
  }

  const steps: ChainStep[] = []
  for (const entry of chain) {
    const match = /^(.*?)\s*--\[(.*?)\]-->\s*(.*)$/.exec(entry)
    if (!match) continue
    const sourceId = resolve(match[1])
    const targetId = resolve(match[3])
    if (!sourceId || !targetId) continue
    steps.push({ sourceId, targetId, relation: match[2] })
  }
  return steps
}

/** Ordered node ids visited by the chain, deduplicated. */
export function chainNodeOrder(steps: ChainStep[]): string[] {
  const order: string[] = []
  for (const step of steps) {
    if (!order.includes(step.sourceId)) order.push(step.sourceId)
    if (!order.includes(step.targetId)) order.push(step.targetId)
  }
  return order
}

const TYPE_RANK: Record<string, number> = {
  Machine: 0,
  Component: 1,
  FailureMode: 2,
  Incident: 3,
  MaintenanceProcedure: 4,
}

export const TYPE_COLOR: Record<string, string> = {
  Machine: '#f5a623',
  Component: '#22d3ee',
  FailureMode: '#f85149',
  Incident: '#d29922',
  MaintenanceProcedure: '#3fb950',
}

export const typeColor = (type: string) => TYPE_COLOR[type] ?? '#8b98a5'

/**
 * Deterministic layered layout used by Lite mode (and as the starting state
 * for the force simulation, which keeps the first frame from exploding).
 */
export function layeredLayout(nodes: KnowledgeNode[], width: number, height: number): Positioned[] {
  const columns = new Map<number, KnowledgeNode[]>()
  nodes.forEach((n) => {
    const rank = TYPE_RANK[n.type] ?? 5
    const list = columns.get(rank) ?? []
    list.push(n)
    columns.set(rank, list)
  })

  const ranks = [...columns.keys()].sort((a, b) => a - b)
  const padX = 96
  const usableW = Math.max(1, width - padX * 2)
  const positions: Positioned[] = []

  ranks.forEach((rank, ci) => {
    const list = columns.get(rank)!
    const x = ranks.length === 1 ? width / 2 : padX + (usableW * ci) / (ranks.length - 1)
    const padY = 56
    const usableH = Math.max(1, height - padY * 2)
    list.forEach((node, ri) => {
      const y = list.length === 1 ? height / 2 : padY + (usableH * ri) / (list.length - 1)
      positions.push({ id: node.id, x, y })
    })
  })

  return positions
}

/** Edge key helper so highlight lookups stay O(1). */
export const edgeKey = (source: string, target: string) => `${source}→${target}`

export function buildEdgeSet(steps: ChainStep[], upTo: number): Set<string> {
  const set = new Set<string>()
  steps.slice(0, upTo).forEach((s) => set.add(edgeKey(s.sourceId, s.targetId)))
  return set
}

export function isChainEdge(edge: KnowledgeEdge, highlighted: Set<string>): boolean {
  return highlighted.has(edgeKey(edge.source, edge.target)) || highlighted.has(edgeKey(edge.target, edge.source))
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KnowledgeEdge, KnowledgeNode } from '@/types/api'
import { useSettingsStore } from '@/store/settingsStore'
import { useForceLayout } from './useForceLayout'
import { buildEdgeSet, chainNodeOrder, isChainEdge, layeredLayout, typeColor, type ChainStep } from './graphLayout'

/**
 * Knowledge-graph canvas with sequential neon traversal.
 *
 * Full mode lays the graph out with d3-force; Lite mode uses the deterministic
 * layered layout. Both render the same SVG and run the same highlight
 * animation, driven by the causal chain the backend actually returned.
 */
/** Node radius by type — shared by the node circles and the edge trimming. */
function radiusOf(type: string | undefined): number {
  return type === 'Machine' ? 20 : 15
}

export default function GraphCanvas({
  nodes,
  edges,
  chain,
  step,
  onSelectNode,
  selectedId,
}: {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  chain: ChainStep[]
  /** How many hops of the chain are currently lit. */
  step: number
  onSelectNode?: (node: KnowledgeNode) => void
  selectedId?: string | null
}) {
  const lite = useSettingsStore((s) => s.perfMode) === 'lite'
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 480 })

  // Pan / zoom state (pointer events cover mouse, pen and touch).
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const pinch = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStart = useRef<{ dist: number; k: number } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setSize({ width: Math.max(320, rect.width), height: Math.max(320, rect.height) })
    }
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const forced = useForceLayout(nodes, edges, size.width, size.height, !lite)
  const positions = useMemo(
    () => (lite ? layeredLayout(nodes, size.width, size.height) : forced),
    [lite, forced, nodes, size.width, size.height],
  )
  const posById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions])
  const nodeTypeById = useMemo(() => new Map(nodes.map((n) => [n.id, n.type])), [nodes])

  const litEdges = useMemo(() => buildEdgeSet(chain, step), [chain, step])
  const chainOrder = useMemo(() => chainNodeOrder(chain), [chain])
  const litNodes = useMemo(() => {
    const set = new Set<string>()
    chain.slice(0, step).forEach((s) => {
      set.add(s.sourceId)
      set.add(s.targetId)
    })
    return set
  }, [chain, step])

  // The node most recently lit gets the strongest glow.
  const leadingNodeId = useMemo(() => {
    if (step <= 0) return null
    const visited = chainOrder.filter((id) => litNodes.has(id))
    return visited[visited.length - 1] ?? null
  }, [chainOrder, litNodes, step])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
      pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch.current.size === 1) {
        drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
      } else if (pinch.current.size === 2) {
        const [a, b] = [...pinch.current.values()]
        pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }
        drag.current = null
      }
    },
    [view],
  )

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!pinch.current.has(e.pointerId)) return
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pinch.current.size >= 2 && pinchStart.current) {
      const [a, b] = [...pinch.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const k = Math.max(0.4, Math.min(2.6, (pinchStart.current.k * dist) / (pinchStart.current.dist || 1)))
      setView((v) => ({ ...v, k }))
      return
    }

    if (drag.current) {
      setView((v) => ({
        ...v,
        x: drag.current!.vx + (e.clientX - drag.current!.x),
        y: drag.current!.vy + (e.clientY - drag.current!.y),
      }))
    }
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    pinch.current.delete(e.pointerId)
    if (pinch.current.size < 2) pinchStart.current = null
    if (pinch.current.size === 0) drag.current = null
  }, [])

  return (
    <>
      <div
        ref={wrapRef}
        className="relative h-[380px] w-full overflow-hidden rounded-ctl border border-hairline bg-[#0b0e13] sm:h-[520px]"
      >
      <svg
        width="100%"
        height="100%"
        className="touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label="Knowledge graph traversal"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#33404d" />
          </marker>
          <marker id="arrow-lit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f85149" />
          </marker>
        </defs>

        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {edges.map((edge, i) => {
            const a = posById.get(edge.source)
            const b = posById.get(edge.target)
            if (!a || !b) return null
            const lit = isChainEdge(edge, litEdges)

            // Trim each end back to the node boundary so the arrowhead is
            // visible instead of being hidden underneath the target circle.
            const dx = b.x - a.x
            const dy = b.y - a.y
            const len = Math.hypot(dx, dy) || 1
            const ux = dx / len
            const uy = dy / len
            const rA = radiusOf(nodeTypeById.get(edge.source))
            const rB = radiusOf(nodeTypeById.get(edge.target))
            const x1 = a.x + ux * (rA + 3)
            const y1 = a.y + uy * (rA + 3)
            const x2 = b.x - ux * (rB + 7)
            const y2 = b.y - uy * (rB + 7)

            return (
              <g key={`${edge.source}-${edge.target}-${i}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={lit ? '#f85149' : '#232a33'}
                  strokeWidth={lit ? 2.4 : 1.2}
                  markerEnd={lit ? 'url(#arrow-lit)' : 'url(#arrow)'}
                  style={lit && !lite ? { filter: 'drop-shadow(0 0 6px rgba(248,81,73,0.85))' } : undefined}
                />
                {lit && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 7}
                    textAnchor="middle"
                    className="fill-crit font-mono"
                    fontSize={9}
                  >
                    {edge.type}
                  </text>
                )}
              </g>
            )
          })}

          {nodes.map((node) => {
            const p = posById.get(node.id)
            if (!p) return null
            const color = typeColor(node.type)
            const lit = litNodes.has(node.id)
            const leading = leadingNodeId === node.id
            const selected = selectedId === node.id
            const radius = radiusOf(node.type)

            return (
              <g
                key={node.id}
                transform={`translate(${p.x},${p.y})`}
                className="cursor-pointer"
                onClick={() => onSelectNode?.(node)}
                style={lit && !lite ? { color: '#f85149' } : undefined}
              >
                {lit && (
                  <circle
                    r={radius + (leading ? 12 : 7)}
                    fill="none"
                    stroke="#f85149"
                    strokeWidth={leading ? 2 : 1}
                    opacity={leading ? 0.85 : 0.45}
                    className={leading && !lite ? 'animate-node-pulse' : undefined}
                  />
                )}
                <circle
                  r={radius}
                  fill={lit ? 'rgba(248,81,73,0.18)' : '#12161c'}
                  stroke={lit ? '#f85149' : selected ? '#f5a623' : color}
                  strokeWidth={lit || selected ? 2.2 : 1.4}
                  style={lit && !lite ? { filter: 'drop-shadow(0 0 10px rgba(248,81,73,0.8))' } : undefined}
                />
                <text
                  y={p.y > size.height * 0.62 ? -(radius + 9) : radius + 14}
                  textAnchor="middle"
                  fontSize={9.5}
                  className="pointer-events-none font-mono"
                  fill={lit ? '#f85149' : '#8b98a5'}
                  stroke="#0b0e13"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {node.id.length > 18 ? `${node.id.slice(0, 17)}…` : node.id}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute right-3 top-2 rounded-full border border-hairline bg-card/85 px-2 py-0.5 text-[9px] text-muted">
        {lite ? 'Lite · layered' : 'Full · force-directed'} · drag to pan, pinch to zoom
      </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-muted">
        {(
          [
            ['Machine', 'Machine'],
            ['Component', 'Component'],
            ['FailureMode', 'Failure mode'],
            ['Incident', 'Incident'],
            ['MaintenanceProcedure', 'SOP'],
          ] as const
        ).map(([type, label]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: typeColor(type) }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-crit">
          <span className="h-0.5 w-4 rounded bg-crit" /> causal chain
        </span>
      </div>
    </>
  )
}

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
  const theme = useSettingsStore((s) => s.theme)
  const isLight = theme === 'light'
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
        className="relative h-[380px] w-full overflow-hidden rounded-ctl border border-slate-200 bg-slate-50/70 shadow-inner dark:border-hairline dark:bg-[#0b0e13] sm:h-[520px]"
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
          <pattern id="graph-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" fill={isLight ? '#94a3b8' : '#334155'} opacity={isLight ? 0.45 : 0.4} />
          </pattern>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={isLight ? '#64748b' : '#475569'} />
          </marker>
          <marker id="arrow-lit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={isLight ? '#dc2626' : '#f85149'} />
          </marker>
        </defs>

        <rect width="100%" height="100%" fill="url(#graph-grid)" />

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
            const x1 = a.x + ux * (rA + 4)
            const y1 = a.y + uy * (rA + 4)
            const x2 = b.x - ux * (rB + 8)
            const y2 = b.y - uy * (rB + 8)

            const strokeColor = lit
              ? (isLight ? '#dc2626' : '#f85149')
              : (isLight ? '#94a3b8' : '#334155')

            return (
              <g key={`${edge.source}-${edge.target}-${i}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={lit ? 2.6 : 1.5}
                  markerEnd={lit ? 'url(#arrow-lit)' : 'url(#arrow)'}
                  style={lit && !lite ? { filter: `drop-shadow(0 0 6px ${isLight ? 'rgba(220,38,38,0.7)' : 'rgba(248,81,73,0.85)'})` } : undefined}
                />
                {lit && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 7}
                    textAnchor="middle"
                    className="font-mono text-[9.5px] font-bold"
                    fill={isLight ? '#dc2626' : '#f85149'}
                    stroke={isLight ? '#ffffff' : '#0b0e13'}
                    strokeWidth={3.5}
                    strokeLinejoin="round"
                    paintOrder="stroke"
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
            const color = typeColor(node.type, isLight)
            const lit = litNodes.has(node.id)
            const leading = leadingNodeId === node.id
            const selected = selectedId === node.id
            const radius = radiusOf(node.type)

            const mainStroke = lit
              ? (isLight ? '#dc2626' : '#f85149')
              : selected
              ? (isLight ? '#d97706' : '#f5a623')
              : color

            const nodeFill = lit
              ? (isLight ? '#fee2e2' : 'rgba(248,81,73,0.22)')
              : (isLight ? '#ffffff' : '#111722')

            return (
              <g
                key={node.id}
                transform={`translate(${p.x},${p.y})`}
                className="cursor-pointer"
                onClick={() => onSelectNode?.(node)}
                style={lit && !lite ? { color: isLight ? '#dc2626' : '#f85149' } : undefined}
              >
                {/* Lit pulse wave */}
                {lit && (
                  <circle
                    r={radius + (leading ? 12 : 7)}
                    fill="none"
                    stroke={isLight ? '#dc2626' : '#f85149'}
                    strokeWidth={leading ? 2.5 : 1.5}
                    opacity={leading ? 0.9 : 0.45}
                    className={leading && !lite ? 'animate-node-pulse' : undefined}
                  />
                )}

                {/* Selected dashed focus ring */}
                {selected && !lit && (
                  <circle
                    r={radius + 6}
                    fill="none"
                    stroke={isLight ? '#d97706' : '#f5a623'}
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    opacity={0.85}
                  />
                )}

                {/* Main circular node container */}
                <circle
                  r={radius}
                  fill={nodeFill}
                  stroke={mainStroke}
                  strokeWidth={lit || selected ? 3 : 2.4}
                  style={
                    lit && !lite
                      ? { filter: `drop-shadow(0 0 10px ${isLight ? 'rgba(220,38,38,0.7)' : 'rgba(248,81,73,0.85)'})` }
                      : isLight
                      ? { filter: 'drop-shadow(0 2px 5px rgba(15,23,42,0.12))' }
                      : { filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }
                  }
                />

                {/* Solid inner center pip - provides instant vivid entity coloring */}
                <circle
                  r={radius * 0.45}
                  fill={mainStroke}
                  opacity={isLight ? 0.95 : 0.85}
                />

                {/* Node ID label with clear contrast halo */}
                <text
                  y={p.y > size.height * 0.62 ? -(radius + 9) : radius + 15}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  className="pointer-events-none font-mono select-none"
                  fill={lit ? (isLight ? '#dc2626' : '#f85149') : (isLight ? '#0f172a' : '#f1f5f9')}
                  stroke={isLight ? '#ffffff' : '#0b0e13'}
                  strokeWidth={isLight ? 4 : 3.5}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {node.id.length > 18 ? `${node.id.slice(0, 17)}…` : node.id}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute right-3 top-2 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur-sm dark:border-hairline dark:bg-card/85 dark:text-muted">
        {lite ? 'Lite · layered' : 'Full · force-directed'} · drag to pan, pinch to zoom
      </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {(
          [
            ['Machine', 'Machine'],
            ['Component', 'Component'],
            ['FailureMode', 'Failure mode'],
            ['Incident', 'Incident'],
            ['MaintenanceProcedure', 'SOP'],
          ] as const
        ).map(([type, label]) => {
          const c = typeColor(type, isLight)
          return (
            <span key={type} className="flex items-center gap-1.5 font-medium">
              <span
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2"
                style={{
                  borderColor: c,
                  backgroundColor: isLight ? '#ffffff' : '#111722',
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: c }}
                />
              </span>
              <span className="text-slate-800 dark:text-slate-200">{label}</span>
            </span>
          )
        })}
        <span className="flex items-center gap-1.5 font-medium text-crit">
          <span className="h-1 w-4 rounded bg-crit" /> causal chain
        </span>
      </div>
    </>
  )
}

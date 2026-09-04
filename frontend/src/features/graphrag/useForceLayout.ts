import { useEffect, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import type { KnowledgeEdge, KnowledgeNode } from '@/types/api'
import { layeredLayout, type Positioned } from './graphLayout'

interface ForceNode extends SimulationNodeDatum {
  id: string
}

/**
 * Force-directed layout for Full performance mode.
 *
 * The simulation is run to a fixed alpha and then stopped: an industrial
 * console should not burn a tablet's battery jiggling a graph forever.
 */
export function useForceLayout(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  width: number,
  height: number,
  enabled: boolean,
): Positioned[] {
  const [positions, setPositions] = useState<Positioned[]>([])
  const simRef = useRef<Simulation<ForceNode, SimulationLinkDatum<ForceNode>> | null>(null)

  useEffect(() => {
    if (!enabled || nodes.length === 0 || width <= 0 || height <= 0) {
      setPositions(nodes.length ? layeredLayout(nodes, width || 800, height || 480) : [])
      return
    }

    // Seed from the deterministic layout so the graph settles predictably.
    const seed = new Map(layeredLayout(nodes, width, height).map((p) => [p.id, p]))
    const simNodes: ForceNode[] = nodes.map((n) => ({ id: n.id, x: seed.get(n.id)?.x, y: seed.get(n.id)?.y }))
    const nodeIds = new Set(nodes.map((n) => n.id))
    const simLinks = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }))

    const sim = forceSimulation<ForceNode>(simNodes)
      .force('charge', forceManyBody<ForceNode>().strength(-680))
      .force(
        'link',
        forceLink<ForceNode, SimulationLinkDatum<ForceNode>>(simLinks)
          .id((d) => d.id)
          .distance(150)
          .strength(0.6),
      )
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<ForceNode>(66).strength(0.95).iterations(2))
      .alpha(1)
      .alphaDecay(0.022)

    simRef.current = sim

    // Clamp inside the simulation, not just when reporting: clamping only on
    // output let nodes drift off-canvas and then pile onto the same edge value,
    // because the collision force never saw the corrected positions.
    const padX = 70
    const padY = 46
    sim.on('tick', () => {
      simNodes.forEach((n) => {
        n.x = Math.max(padX, Math.min(width - padX, n.x ?? width / 2))
        n.y = Math.max(padY, Math.min(height - padY, n.y ?? height / 2))
      })
      setPositions(simNodes.map((n) => ({ id: n.id, x: n.x as number, y: n.y as number })))
    })

    sim.on('end', () => sim.stop())

    return () => {
      sim.stop()
      simRef.current = null
    }
  }, [nodes, edges, width, height, enabled])

  return positions
}

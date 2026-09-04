import { useMemo, useState } from 'react'
import { BAYS, type FloorMachine } from './bays'

/**
 * Lite-mode plant floor: a pure SVG isometric projection with the same
 * beacon semantics as the 3D view. No WebGL, no per-frame work.
 */
const TILE_W = 120
const TILE_H = 60
const ORIGIN_X = 430
const ORIGIN_Y = 90

/** Standard 2:1 isometric projection. */
const project = (col: number, row: number) => ({
  x: ORIGIN_X + ((col - row) * TILE_W) / 2,
  y: ORIGIN_Y + ((col + row) * TILE_H) / 2,
})

function Tile({ col, row, highlight }: { col: number; row: number; highlight: boolean }) {
  const p = project(col, row)
  const points = [
    `${p.x},${p.y}`,
    `${p.x + TILE_W / 2},${p.y + TILE_H / 2}`,
    `${p.x},${p.y + TILE_H}`,
    `${p.x - TILE_W / 2},${p.y + TILE_H / 2}`,
  ].join(' ')
  return <polygon points={points} fill={highlight ? '#12161c' : '#0f141a'} stroke="#232a33" strokeWidth={1} />
}

function MachineBlock({
  item,
  col,
  row,
  onSelect,
  selected,
}: {
  item: FloorMachine
  col: number
  row: number
  onSelect: (id: string) => void
  selected: boolean
}) {
  const p = project(col, row)
  const h = 34 + Math.min(18, item.machine.operating_hours / 800)
  const cx = p.x
  const topY = p.y + TILE_H / 2 - h

  const beaconClass =
    item.beacon === 'strobe' ? 'animate-beacon-strobe' : item.beacon === 'blink' ? 'animate-beacon-blink' : ''

  return (
    <g className="cursor-pointer" onClick={() => onSelect(item.machine.machine_id)} tabIndex={0} role="button" aria-label={item.machine.machine_id}>
      {/* Left face */}
      <polygon
        points={`${cx - TILE_W / 2 + 18},${p.y + TILE_H / 2 - 8} ${cx},${p.y + TILE_H - 12} ${cx},${p.y + TILE_H - 12 - h} ${cx - TILE_W / 2 + 18},${p.y + TILE_H / 2 - 8 - h}`}
        fill="#161b22"
        stroke={selected ? '#f5a623' : '#232a33'}
      />
      {/* Right face */}
      <polygon
        points={`${cx + TILE_W / 2 - 18},${p.y + TILE_H / 2 - 8} ${cx},${p.y + TILE_H - 12} ${cx},${p.y + TILE_H - 12 - h} ${cx + TILE_W / 2 - 18},${p.y + TILE_H / 2 - 8 - h}`}
        fill="#1b212a"
        stroke={selected ? '#f5a623' : '#232a33'}
      />
      {/* Top face */}
      <polygon
        points={`${cx},${topY - 8} ${cx + TILE_W / 2 - 18},${p.y + TILE_H / 2 - 8 - h} ${cx},${p.y + TILE_H - 12 - h} ${cx - TILE_W / 2 + 18},${p.y + TILE_H / 2 - 8 - h}`}
        fill="#20272f"
        stroke={selected ? '#f5a623' : '#2c3542'}
      />

      {/* Status beacon */}
      <g className={beaconClass} style={{ transformOrigin: `${cx}px ${topY - 20}px` }}>
        <circle cx={cx} cy={topY - 20} r={12} fill={item.color} opacity={0.18} />
        <circle cx={cx} cy={topY - 20} r={5.5} fill={item.color} />
      </g>
      <line x1={cx} y1={topY - 14} x2={cx} y2={topY - 6} stroke={item.color} strokeWidth={1.5} opacity={0.6} />

      <text x={cx} y={p.y + TILE_H + 16} textAnchor="middle" fontSize={10} className="font-mono" fill="#8b98a5">
        {item.machine.machine_id}
      </text>
    </g>
  )
}

export default function IsoFloor2D({
  floor,
  onSelect,
  selectedId,
}: {
  floor: FloorMachine[]
  onSelect: (id: string) => void
  selectedId: string | null
}) {
  const [view, setView] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null)

  // Row per bay, column per slot.
  const placed = useMemo(
    () =>
      floor.map((item) => ({
        item,
        row: BAYS.indexOf(item.bay),
        col: item.slot,
      })),
    [floor],
  )

  const maxCol = Math.max(2, ...placed.map((p) => p.col + 1))

  return (
    <svg
      viewBox="0 0 860 460"
      className="h-full w-full touch-none select-none"
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging({ x: e.clientX, y: e.clientY, vx: view.x, vy: view.y })
      }}
      onPointerMove={(e) => {
        if (!dragging) return
        setView({ x: dragging.vx + (e.clientX - dragging.x), y: dragging.vy + (e.clientY - dragging.y) })
      }}
      onPointerUp={() => setDragging(null)}
      onPointerCancel={() => setDragging(null)}
      role="img"
      aria-label="Isometric plant floor"
    >
      <g transform={`translate(${view.x},${view.y})`}>
        {/* Floor tiles */}
        {BAYS.map((_, row) =>
          Array.from({ length: maxCol }).map((__, col) => (
            <Tile key={`${row}-${col}`} col={col} row={row} highlight={(row + col) % 2 === 0} />
          )),
        )}

        {/* Bay labels */}
        {BAYS.map((bay, row) => {
          const p = project(-0.6, row)
          return (
            <text
              key={bay}
              x={p.x}
              y={p.y + TILE_H / 2 + 4}
              textAnchor="end"
              fontSize={11}
              className="font-mono"
              fill="#f5a623"
              opacity={0.75}
            >
              {bay}
            </text>
          )
        })}

        {/* Machines, painted back-to-front so nearer blocks overlap correctly */}
        {placed
          .slice()
          .sort((a, b) => a.row + a.col - (b.row + b.col))
          .map(({ item, row, col }) => (
            <MachineBlock
              key={item.machine.machine_id}
              item={item}
              col={col}
              row={row}
              onSelect={onSelect}
              selected={selectedId === item.machine.machine_id}
            />
          ))}
      </g>
    </svg>
  )
}

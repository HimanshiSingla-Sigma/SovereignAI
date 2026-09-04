import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { BAYS, type FloorMachine } from './bays'

/**
 * Full-mode plant floor: react-three-fiber.
 *
 * Deliberately built from primitives — no external model files, nothing
 * fetched at runtime, so it works on an air-gapped workstation.
 */

const BAY_SPACING = 4.2
const SLOT_SPACING = 3.4

function Beacon({ item }: { item: FloorMachine }) {
  const light = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    if (!material.current || !light.current) return
    const t = clock.getElapsedTime()
    let intensity = 1.5
    if (item.beacon === 'blink') {
      intensity = 0.25 + 1.9 * (0.5 + 0.5 * Math.sin(t * 5.4))
    } else if (item.beacon === 'strobe') {
      // Hard on/off strobe rather than a smooth fade.
      intensity = Math.sin(t * 16) > 0.2 ? 4.2 : 0.15
    }
    material.current.emissiveIntensity = intensity
    const scale = item.beacon === 'strobe' ? 1 + 0.12 * Math.sin(t * 16) : 1
    light.current.scale.setScalar(scale)
  })

  const color = useMemo(() => new THREE.Color(item.color), [item.color])

  return (
    <mesh ref={light} position={[0, 1.5, 0]}>
      <sphereGeometry args={[0.22, 16, 16]} />
      <meshStandardMaterial ref={material} color={color} emissive={color} emissiveIntensity={1.5} toneMapped={false} />
    </mesh>
  )
}

function MachineUnit({
  item,
  position,
  selected,
  onSelect,
}: {
  item: FloorMachine
  position: [number, number, number]
  selected: boolean
  onSelect: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const height = 1.1 + Math.min(0.9, item.machine.operating_hours / 12000)

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(item.machine.machine_id)
  }

  return (
    <group position={position}>
      <mesh
        position={[0, height / 2, 0]}
        castShadow
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <boxGeometry args={[1.6, height, 1.6]} />
        <meshStandardMaterial
          color={selected ? '#2a3340' : hovered ? '#222a34' : '#1a2028'}
          emissive={selected ? new THREE.Color('#f5a623') : new THREE.Color('#000000')}
          emissiveIntensity={selected ? 0.22 : 0}
          metalness={0.35}
          roughness={0.65}
        />
      </mesh>

      {/* Beacon mast */}
      <mesh position={[0, height + 0.2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
        <meshStandardMaterial color="#33404d" metalness={0.6} roughness={0.4} />
      </mesh>

      <group position={[0, height - 0.6, 0]}>
        <Beacon item={item} />
      </group>

      {/* Status pool on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.15, 1.45, 32]} />
        <meshBasicMaterial color={item.color} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** Drag-to-orbit around Y — enough control without pulling in a controls dependency. */
function OrbitGroup({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const target = useRef(0.6)
  const drag = useRef<{ x: number; start: number } | null>(null)

  useFrame(() => {
    if (!group.current) return
    group.current.rotation.y += (target.current - group.current.rotation.y) * 0.12
  })

  return (
    <group
      ref={group}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, start: target.current }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        target.current = drag.current.start + (e.clientX - drag.current.x) * 0.006
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerLeave={() => {
        drag.current = null
      }}
    >
      {children}
    </group>
  )
}

function Bay({ row, label }: { row: number; label: string }) {
  void label
  const z = (row - (BAYS.length - 1) / 2) * BAY_SPACING
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z]} receiveShadow>
      <planeGeometry args={[14, 3.2]} />
      <meshStandardMaterial color={row % 2 === 0 ? '#12161c' : '#0f141a'} roughness={0.95} />
    </mesh>
  )
}

export default function Floor3D({
  floor,
  onSelect,
  selectedId,
}: {
  floor: FloorMachine[]
  onSelect: (id: string) => void
  selectedId: string | null
}) {
  const maxSlot = Math.max(1, ...floor.map((f) => f.slot + 1))

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [0, 9.5, 13], fov: 42 }}
      className="touch-none"
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#0b0e13']} />
      <fog attach="fog" args={['#0b0e13', 18, 34]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 12, 6]} intensity={0.85} castShadow />
      <pointLight position={[-8, 6, -4]} intensity={0.35} color="#22d3ee" />

      <OrbitGroup>
        {BAYS.map((bay, row) => (
          <Bay key={bay} row={row} label={bay} />
        ))}

        {/* Floor grid */}
        <gridHelper args={[26, 26, '#232a33', '#171d24']} position={[0, 0.01, 0]} />

        {floor.map((item) => {
          const row = BAYS.indexOf(item.bay)
          const x = (item.slot - (maxSlot - 1) / 2) * SLOT_SPACING
          const z = (row - (BAYS.length - 1) / 2) * BAY_SPACING
          return (
            <MachineUnit
              key={item.machine.machine_id}
              item={item}
              position={[x, 0, z]}
              selected={selectedId === item.machine.machine_id}
              onSelect={onSelect}
            />
          )
        })}
      </OrbitGroup>
    </Canvas>
  )
}

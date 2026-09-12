import { useState, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  RefreshCw,
  Shield,
  ShieldAlert,
} from 'lucide-react'
import { Badge, PageHeader, Panel } from '@/components/ui'

interface BlockData {
  index: number
  timestamp: string
  action: string
  prevHash: string
  hash: string
  tampered: boolean
}

const INITIAL_BLOCKS: BlockData[] = [
  {
    index: 40,
    timestamp: '2026-09-12 18:20:11 UTC',
    action: 'TELEMETRY_LOG: Machine-001 Temp 42.5C Vib 1.20mm/s',
    prevHash: '7b28f3a1d9e4c8b210...',
    hash: 'a1b2c3d4e5f6789012...',
    tampered: false,
  },
  {
    index: 41,
    timestamp: '2026-09-12 18:22:45 UTC',
    action: 'APPROVAL_SIGN: Safety Officer signed SOP-MNT-042',
    prevHash: 'a1b2c3d4e5f6789012...',
    hash: 'b3c4d5e6f7a8b9c0d1...',
    tampered: false,
  },
  {
    index: 42,
    timestamp: '2026-09-12 18:24:02 UTC',
    action: 'SAFETY_INTERLOCK: Machine-002 Deceleration Trip Setpoint 4.5 mm/s',
    prevHash: 'b3c4d5e6f7a8b9c0d1...',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    tampered: false,
  },
  {
    index: 43,
    timestamp: '2026-09-12 18:25:30 UTC',
    action: 'ACTUATOR_EXECUTE: Valve #4 Coolant Flow Restored 100%',
    prevHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    hash: 'd4e5f6a7b8c9d0e1f2...',
    tampered: false,
  },
]

/** 3D Block Mesh */
function LedgerBlock3D({
  data,
  isBroken,
}: {
  data: BlockData
  isBroken: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const y = (data.index - 41.5) * 1.6

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    if (isBroken && data.tampered) {
      const t = clock.getElapsedTime()
      meshRef.current.rotation.x = Math.sin(t * 8) * 0.15
      meshRef.current.rotation.z = Math.cos(t * 8) * 0.15
    }
  })

  return (
    <group position={[0, y, 0]}>
      {/* 3D Block */}
      <mesh ref={meshRef} castShadow>
        <boxGeometry args={[3.8, 0.9, 1.4]} />
        <meshStandardMaterial
          color={data.tampered ? '#ef4444' : '#1e293b'}
          emissive={data.tampered ? '#b91c1c' : '#000000'}
          emissiveIntensity={data.tampered ? 0.8 : 0}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>

      {/* Chained Connector Ring between blocks */}
      {data.index < 43 && (
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.7, 12]} />
          <meshStandardMaterial
            color={data.tampered ? '#ef4444' : '#10b981'}
            emissive={data.tampered ? '#ef4444' : '#10b981'}
            emissiveIntensity={data.tampered ? 0.9 : 0.3}
          />
        </mesh>
      )}
    </group>
  )
}

export default function LedgerTamperPage() {
  const [blocks, setBlocks] = useState<BlockData[]>(INITIAL_BLOCKS)
  const [isAttacked, setIsAttacked] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  const handleTamperAttack = () => {
    setIsAttacked(true)
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.index === 42) {
          return {
            ...b,
            action: 'MALICIOUS_FORGERY: Threshold altered to 999.0 mm/s (Disabled)',
            hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
            tampered: true,
          }
        }
        if (b.index > 42) {
          return {
            ...b,
            tampered: true, // cascade fracture
          }
        }
        return b
      })
    )
  }

  const handleRestoreLedger = () => {
    setIsVerifying(true)
    setTimeout(() => {
      setBlocks(INITIAL_BLOCKS)
      setIsAttacked(false)
      setIsVerifying(false)
    }, 600)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Interactive 'Hack My Ledger' Attack Simulator"
        subtitle="Cryptographic verification of chained HMAC SHA-256 audit trails & zero-trust tamper evidence"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/safety" className="btn btn-sm">
              <Shield className="h-3.5 w-3.5" /> Safety Gate
            </Link>
            <Link to="/god-view" className="btn btn-sm">
              <Boxes className="h-3.5 w-3.5" /> Plant Floor
            </Link>
          </div>
        }
      />

      {/* ADVERSARIAL ATTACK ALERT BANNER */}
      {isAttacked && (
        <div className="rounded-card border border-red-500 bg-red-950/60 p-4 backdrop-blur space-y-2 text-xs font-mono shadow-[0_0_24px_rgba(239,68,68,0.3)] animate-pulse">
          <div className="flex items-center justify-between text-red-300 font-bold">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              <span>[ CRYPTOGRAPHIC FORGERY DETECTED: HASH MISMATCH AT BLOCK #42 ]</span>
            </div>
            <Badge severity="crit">CHAIN COMPROMISED</Badge>
          </div>
          <div className="rounded bg-black/60 p-2.5 space-y-1 text-slate-300">
            <div>
              • Expected Hash: <span className="text-emerald-400">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</span>
            </div>
            <div>
              • Computed Hash: <span className="text-red-400">9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08</span>
            </div>
            <div className="pt-1 text-amber-300 font-bold">
              ⚡ ACTION TAKEN: Dual-Rail Safety Interlock engaged. Physical actuator bus FROZEN. Zero physical commands permitted.
            </div>
          </div>
        </div>
      )}

      {/* ATTACK SIMULATION CONTROLLER */}
      <Panel className="p-4" bodyClass="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-white font-mono">
              ADVERSARIAL ATTACK BENCHMARK (JUDGE HANDS-ON DEMO):
            </div>
            <div className="text-xs text-slate-400">
              Test the cryptographic integrity of the chained audit log by injecting a database row modification.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isAttacked ? (
              <button
                onClick={handleTamperAttack}
                className="btn btn-sm bg-red-600 hover:bg-red-700 text-white font-bold font-mono flex items-center gap-1.5 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
              >
                <AlertTriangle className="h-4 w-4" /> ⚠️ SIMULATE ADVERSARIAL TAMPER ATTACK
              </button>
            ) : (
              <button
                onClick={handleRestoreLedger}
                disabled={isVerifying}
                className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-mono flex items-center gap-1.5"
              >
                <RefreshCw className={`h-4 w-4 ${isVerifying ? 'animate-spin' : ''}`} /> Reseal & Verify HMAC Chain
              </button>
            )}
          </div>
        </div>
      </Panel>

      {/* 3D CHAINED LEDGER VISUALIZATION & DATA TABLE */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 font-mono text-xs">
        {/* 3D CHAIN CANVAS */}
        <div className="relative rounded-card border border-slate-800 bg-[#070a0f] lg:col-span-5 min-h-[440px] flex items-center justify-center overflow-hidden">
          <div className="absolute top-3 left-3 z-10 text-[10px] uppercase font-bold text-slate-400 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
            3D Chained Cryptographic Blocks
          </div>

          <Canvas camera={{ position: [0, 0, 5], fov: 45 }} className="h-[440px] w-full">
            <ambientLight intensity={0.7} />
            <directionalLight position={[4, 8, 4]} intensity={1.5} />
            <pointLight position={[-4, 2, -2]} intensity={0.6} color={isAttacked ? '#ef4444' : '#10b981'} />
            <group position={[0, 0, 0]}>
              {blocks.map((b) => (
                <LedgerBlock3D key={b.index} data={b} isBroken={isAttacked} />
              ))}
            </group>
          </Canvas>
        </div>

        {/* LEDGER RECORDS TABLE */}
        <div className="space-y-2 lg:col-span-7">
          {blocks.map((b) => (
            <div
              key={b.index}
              className={`rounded-card border p-3 transition-colors ${
                b.tampered
                  ? 'border-red-500/60 bg-red-950/30'
                  : 'border-slate-800 bg-slate-900/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-bold text-sky-300">
                    Block #{b.index}
                  </span>
                  <span className="text-slate-400 text-[11px]">{b.timestamp}</span>
                </div>
                {b.tampered ? (
                  <Badge severity="crit">FORGED</Badge>
                ) : (
                  <Badge severity="ok">VERIFIED HMAC</Badge>
                )}
              </div>

              <div className="text-slate-200 font-semibold mb-1">{b.action}</div>

              <div className="grid grid-cols-1 gap-0.5 text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                <div className="truncate">
                  <span className="text-slate-500">Prev Hash:</span> {b.prevHash}
                </div>
                <div className="truncate">
                  <span className={b.tampered ? 'text-red-400 font-bold' : 'text-slate-500'}>
                    Current Hash:
                  </span>{' '}
                  {b.hash}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MERKLE TREE INTEGRITY & DUAL-RAIL HARDWARE INTERLOCK SUITE */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 font-mono text-xs">
        {/* MERKLE TREE ROOT HASH PIPELINE */}
        <div className="rounded-card border border-slate-800 bg-slate-950/60 p-4 lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${isAttacked ? 'bg-red-500 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="font-bold uppercase text-white text-xs">
                MERKLE TREE CRYPTOGRAPHIC CHAIN PROOF
              </span>
            </div>
            <span className={`text-[10px] font-bold ${isAttacked ? 'text-red-400' : 'text-emerald-400'}`}>
              {isAttacked ? 'CASCADE INTEGRITY FAILURE' : 'ROOT PROOF VALIDATED'}
            </span>
          </div>

          {/* Visual Merkle Tree Structure */}
          <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800 space-y-2.5">
            {/* Merkle Root Node */}
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Merkle Root Hash (HMAC-SHA256)</div>
              <div className={`inline-block px-3 py-1.5 rounded-lg border font-mono text-[11px] font-bold ${
                isAttacked
                  ? 'border-red-500 bg-red-950/60 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                  : 'border-emerald-500 bg-emerald-950/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              }`}>
                {isAttacked ? 'ROOT: 0x9f86d... INVALIDATED (ATTACK DETECTED)' : 'ROOT: 0x3d7b4e918a2f00c14b2d... [MATCHED]'}
              </div>
            </div>

            {/* Tree Branch Lines */}
            <div className="flex justify-around text-slate-600 text-xs font-bold">
              <span>┌──────────────┴──────────────┐</span>
            </div>

            {/* Intermediate Hash Nodes */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded bg-slate-950/80 p-2 border border-slate-800 text-[10px]">
                <div className="text-slate-400">Branch Hash 0–1 (Blocks #40–41)</div>
                <div className="text-emerald-400 font-bold truncate mt-0.5">0xa1b2c3d4e5f6... (OK)</div>
              </div>
              <div className={`rounded p-2 border text-[10px] ${
                isAttacked
                  ? 'bg-red-950/50 border-red-500 text-red-300'
                  : 'bg-slate-950/80 border-slate-800 text-emerald-400'
              }`}>
                <div className="text-slate-400">Branch Hash 2–3 (Blocks #42–43)</div>
                <div className="font-bold truncate mt-0.5">
                  {isAttacked ? '0x9f86d081... (TAMPERED)' : '0xd4e5f6a7b8c9... (OK)'}
                </div>
              </div>
            </div>

            {/* Leaf Nodes */}
            <div className="grid grid-cols-4 gap-1.5 text-center text-[9px] pt-1">
              <div className="rounded bg-slate-800/60 p-1 text-slate-300">Leaf #40 [Valid]</div>
              <div className="rounded bg-slate-800/60 p-1 text-slate-300">Leaf #41 [Valid]</div>
              <div className={`rounded p-1 font-bold ${isAttacked ? 'bg-red-500/30 text-red-300 border border-red-500' : 'bg-slate-800/60 text-slate-300'}`}>
                {isAttacked ? 'Leaf #42 [FORGED]' : 'Leaf #42 [Valid]'}
              </div>
              <div className={`rounded p-1 ${isAttacked ? 'bg-amber-950/40 text-amber-300' : 'bg-slate-800/60 text-slate-300'}`}>
                {isAttacked ? 'Leaf #43 [FRACTURED]' : 'Leaf #43 [Valid]'}
              </div>
            </div>
          </div>
        </div>

        {/* DUAL-RAIL ACTUATOR HARDWARE INTERLOCK STATUS */}
        <div className="space-y-4 lg:col-span-5 font-mono text-xs">
          <div className="rounded-card border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-white uppercase text-xs">
                <Shield className="h-3.5 w-3.5 text-sky-400" />
                <span>DUAL-RAIL ACTUATOR INTERLOCK</span>
              </div>
              <Badge severity={isAttacked ? 'crit' : 'ok'}>
                {isAttacked ? 'HARDWARE LOCKED' : 'INTERLOCK ARMED'}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded bg-slate-900/60 p-2 border border-slate-800">
                <div>
                  <div className="text-white font-semibold">Relay #1: Physical Trip Coil</div>
                  <div className="text-[10px] text-slate-400">Hardwired galvanic disconnect</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isAttacked ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {isAttacked ? 'TRIPPED (OPEN)' : 'CLOSED (ENERGIZED)'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded bg-slate-900/60 p-2 border border-slate-800">
                <div>
                  <div className="text-white font-semibold">Relay #2: Actuator Command Gate</div>
                  <div className="text-[10px] text-slate-400">Opto-coupled digital latch</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isAttacked ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {isAttacked ? 'FROZEN (DISARMED)' : 'ARMED (SECURE)'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded bg-slate-900/60 p-2 border border-slate-800 text-[11px]">
                <span className="text-slate-400">Hardware Watchdog Pulse:</span>
                <span className="font-bold text-sky-400">1,000 Hz Keepalive</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
              {isAttacked
                ? '⚡ FAIL-SAFE ACTIVE: Tampered block immediately broke Merkle root. Physical relays automatically disengaged without relying on OS software.'
                : '✔ ZERO-TRUST: Every SCADA action is cryptographically chained. Any alteration immediately opens safety relays.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

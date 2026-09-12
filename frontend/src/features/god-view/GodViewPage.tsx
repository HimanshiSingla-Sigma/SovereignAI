import { Suspense, lazy, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Boxes,
  Maximize2,
  ShieldAlert,
  ShieldCheck,
  Waves,
  ScanLine,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  X,
} from 'lucide-react'
import { useMachines } from '@/hooks/useApi'
import { useAlertStore } from '@/store/alertStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useSound } from '@/hooks/useSound'
import { num, severityOf } from '@/lib/format'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel, StatusDot } from '@/components/ui'
import IsoFloor2D from './IsoFloor2D'
import { BAYS, buildFloor, type FloorMachine } from './bays'

// Three.js only enters the bundle graph when Full mode actually renders it.
const Floor3D = lazy(() => import('./Floor3D'))

export default function GodViewPage() {
  const machines = useMachines()
  const live = useAlertStore((s) => s.live)
  const perfMode = useSettingsStore((s) => s.perfMode)
  const select = useSelectionStore((s) => s.select)
  const { play } = useSound()
  const navigate = useNavigate()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredMachine, setHoveredMachine] = useState<FloorMachine | null>(null)

  // 1. View Mode: Standard Industrial Studio, FLIR Thermal IR-640, Autonomous LiDAR Point Cloud
  const [viewMode, setViewMode] = useState<'standard' | 'thermal' | 'lidar'>('standard')

  // 2. Ghost Flow Hydraulics & Coolant System Throttle Valve (0 - 100%)
  const [valve, setValve] = useState<number>(85)
  const [showGhostFlow, setShowGhostFlow] = useState<boolean>(false)

  // 3. Sovereign Air-Gap Dome & Egress Deflection Simulator
  const [showForcefield, setShowForcefield] = useState<boolean>(true)
  const [showAirGap, setShowAirGap] = useState<boolean>(false)
  const [egressTrigger, setEgressTrigger] = useState<number>(0)
  const [egressBlocks, setEgressBlocks] = useState<number>(47)
  const [egressAlert, setEgressAlert] = useState<string | null>(null)

  const floor = useMemo(() => buildFloor(machines.data ?? [], live), [machines.data, live])

  const selectedMachine = useMemo(() => {
    if (!selectedId) return null
    return floor.find((f) => f.machine.machine_id === selectedId) ?? null
  }, [selectedId, floor])

  // Click a machine → smooth 3D camera focus on the asset and open contextual information card
  const handleSelectMachine = (machineId: string) => {
    play('click')
    setSelectedId(machineId)
    select(machineId, 'god-view')
  }

  const handleBackToPlant = () => {
    play('click')
    setSelectedId(null)
  }

  const handleNavigateToDigitalTwin = (machineId: string) => {
    play('toggle')
    select(machineId, 'god-view')
    navigate('/digital-twin')
  }

  // Trigger adversarial outbound leak attempt deflected by perimeter cyber-shield
  const handleSimulateEgress = () => {
    play('denied')
    setEgressTrigger((prev) => prev + 1)
    setEgressBlocks((prev) => prev + 1)
    setEgressAlert('AIR-GAP INTERCEPT: Deflected outbound TCP SYN [Dest: cloud-eu.aws.iot:443]. Physical NIC hardware boundary enforced.')
    window.setTimeout(() => {
      setEgressAlert(null)
    }, 4800)
  }

  const counts = useMemo(() => {
    const c = { steady: 0, blink: 0, strobe: 0 }
    floor.forEach((f) => {
      c[f.beacon] += 1
    })
    return c
  }, [floor])

  const flowRate = (valve * 1.45).toFixed(1)
  const linePressure = valve === 0 ? '0.0' : (2.1 + (valve / 100) * 4.8).toFixed(1)
  const isCavitation = valve > 90

  return (
    <div className="space-y-4">
      <PageHeader
        title="Plant floor"
        subtitle="Every asset in its bay, beacons driven by the live telemetry stream"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge severity="ok">
              <StatusDot severity="ok" /> {counts.steady} normal
            </Badge>
            <Badge severity="warn">
              <StatusDot severity="warn" pulse /> {counts.blink} warning
            </Badge>
            <Badge severity="crit">
              <StatusDot severity="crit" pulse /> {counts.strobe} critical
            </Badge>
          </div>
        }
      />

      {machines.isPending && <Loading label="Loading plant layout…" />}
      {machines.isError && <ErrorState error={machines.error} onRetry={() => machines.refetch()} />}
      {machines.data && machines.data.length === 0 && <EmptyState label="No assets to place on the floor." />}

      {machines.data && machines.data.length > 0 && (
        <>
          <Panel
            title={
              <div className="flex items-center gap-2">
                <span>{perfMode === 'full' ? 'Isometric Plant Floor — 3D Cyber-Physical Twin' : 'Isometric floor — Lite'}</span>
                {viewMode === 'thermal' && (
                  <span className="rounded bg-orange-500/20 px-2 py-0.5 text-[10px] font-mono text-orange-400 border border-orange-500/40">
                    FLIR IR-640 ACTIVE
                  </span>
                )}
                {viewMode === 'lidar' && (
                  <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/40">
                    LiDAR POINT CLOUD ACTIVE
                  </span>
                )}
              </div>
            }
            subtitle="Tap a machine to inspect digital twin · drag floor to orbit"
            right={
              <div className="flex items-center gap-2">
                <Badge severity="info">
                  <Maximize2 className="h-3 w-3" /> {perfMode === 'full' ? 'Full 3D' : 'Lite'}
                </Badge>
              </div>
            }
            bodyClass="p-0"
          >
            <div className="relative h-[440px] overflow-hidden rounded-b-card bg-[#0b0e13] transition-transform duration-300 sm:h-[540px]">
              {perfMode === 'full' ? (
                <Suspense fallback={<Loading label="Initialising 3D floor…" />}>
                  <Floor3D
                    floor={floor}
                    onSelect={handleSelectMachine}
                    selectedId={selectedId}
                    viewMode={viewMode}
                    valve={valve}
                    egressTrigger={egressTrigger}
                    showForcefield={showForcefield}
                    onHover={setHoveredMachine}
                  />
                </Suspense>
              ) : (
                <IsoFloor2D floor={floor} onSelect={handleSelectMachine} selectedId={selectedId} />
              )}

              {/* OUTBOUND EGRESS DEFLECTION ALERT BANNER */}
              {egressAlert && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex max-w-xl items-center gap-2.5 rounded-full border border-red-500/80 bg-red-950/90 px-4 py-2 text-xs font-mono text-red-200 shadow-2xl backdrop-blur-md animate-bounce">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-red-400 animate-pulse" />
                  <span className="truncate">{egressAlert}</span>
                </div>
              )}

              {/* TOP HOVER TOOLTIP OVERLAY (when hovering and no machine selected) */}
              {hoveredMachine && !selectedId && (
                <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/90 px-3.5 py-1.5 text-xs font-mono text-slate-200 shadow-2xl backdrop-blur-md">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: hoveredMachine.color }}
                  />
                  <span className="font-bold text-white">{hoveredMachine.machine.machine_id}</span>
                  <span className="text-muted">·</span>
                  <span className="text-slate-300">{hoveredMachine.machine.name}</span>
                  <span className="text-muted">·</span>
                  <span className="text-[11px] text-accent font-semibold">{hoveredMachine.bay}</span>
                  <span className="text-[10px] text-muted">(Click to focus)</span>
                </div>
              )}

              {/* TOP-LEFT CONTROLS: BACK TO PLANT VIEW & GHOST FLOW HUD */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                {selectedId && (
                  <button
                    type="button"
                    onClick={handleBackToPlant}
                    className="flex items-center gap-1.5 rounded-lg border border-accent/70 bg-slate-900/90 px-3 py-1.5 text-xs font-mono font-semibold text-accent shadow-xl backdrop-blur-md transition-all hover:bg-accent hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Back to Plant View</span>
                  </button>
                )}

                {!showGhostFlow ? (
                  <button
                    type="button"
                    onClick={() => setShowGhostFlow(true)}
                    className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-slate-900/80 px-3 py-1.5 text-xs font-mono text-cyan-300 backdrop-blur-md transition-colors hover:bg-slate-800"
                  >
                    <Waves className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Ghost Flow HUD</span>
                    <span className="text-[10px] text-muted">({valve}%)</span>
                  </button>
                ) : (
                  <div className="w-64 rounded-xl border border-cyan-500/40 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-md space-y-2.5">
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                        <Waves className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Ghost Flow Conduits</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowGhostFlow(false)}
                        className="text-[10px] text-muted hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-muted mb-1">
                        <span>Throttle Valve</span>
                        <span className="text-cyan-300 font-bold">{valve}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={valve}
                        onChange={(e) => setValve(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="rounded bg-slate-900/80 p-1.5 border border-white/5">
                        <span className="text-muted block">Flow Rate</span>
                        <span className="text-white font-bold text-xs">{flowRate} L/min</span>
                      </div>
                      <div className="rounded bg-slate-900/80 p-1.5 border border-white/5">
                        <span className="text-muted block">Line Press.</span>
                        <span className="text-white font-bold text-xs">{linePressure} bar</span>
                      </div>
                    </div>

                    {isCavitation ? (
                      <div className="flex items-center gap-1.5 rounded bg-red-950/80 border border-red-500/50 p-1.5 text-[10px] font-mono text-red-300">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400 animate-pulse" />
                        <span>CAVITATION: Vapor bubble implosions</span>
                      </div>
                    ) : valve === 0 ? (
                      <div className="rounded bg-amber-950/60 border border-amber-500/40 p-1 text-[10px] font-mono text-amber-300 text-center">
                        FLOW HALTED (Valve Closed)
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 rounded">
                        <span>LAMINAR REGIME</span>
                        <span>Re {Math.round(valve * 34)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* TOP-RIGHT: SOVEREIGN AIR-GAP DOME DRAWER */}
              <div className="absolute top-3 right-3 z-20">
                {!showAirGap ? (
                  <button
                    type="button"
                    onClick={() => setShowAirGap(true)}
                    className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-slate-900/80 px-3 py-1.5 text-xs font-mono text-blue-300 backdrop-blur-md transition-colors hover:bg-slate-800"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                    <span>Air-Gap Dome</span>
                    <span className="rounded bg-blue-500/20 px-1 text-[10px] text-blue-300">100% GAPPED</span>
                  </button>
                ) : (
                  <div className="w-68 rounded-xl border border-blue-500/40 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-md space-y-2.5">
                    <div className="flex items-center justify-between border-b border-blue-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                        <span>Data Sovereignty Perimeter</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAirGap(false)}
                        className="text-[10px] text-muted hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-1 text-[10px] font-mono text-muted">
                      <div className="flex justify-between">
                        <span>Physical Layer:</span>
                        <span className="text-emerald-400 font-semibold">GALVANIC ISOLATION</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Outbound NICs:</span>
                        <span className="text-red-400 font-semibold">HARDWARE CUT</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Deflected Egress:</span>
                        <span className="text-cyan-300 font-bold">{egressBlocks} packets</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-1.5 text-[10px] text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showForcefield}
                          onChange={(e) => setShowForcefield(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
                        />
                        <span>Render 3D Dome</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleSimulateEgress}
                        className="flex items-center gap-1 rounded bg-red-600/30 hover:bg-red-600/50 border border-red-500/50 px-2 py-1 text-[10px] font-mono text-red-200 transition-colors"
                      >
                        <ShieldAlert className="h-3 w-3 text-red-400" />
                        <span>Simulate Leak</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* FLIR THERMAL HUD OVERLAY */}
              {viewMode === 'thermal' && (
                <div className="pointer-events-none absolute inset-0 z-10">
                  {/* Center Crosshair Target */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-400">
                    <div className="relative h-12 w-12 border border-orange-400/40 rounded-full flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-orange-400" />
                      <div className="absolute -top-5 text-[9px] font-mono text-orange-300 font-bold">
                        HOTSPOT 78.4°C
                      </div>
                    </div>
                  </div>

                  {/* Thermal Ironbow Ramp Bar on right */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-mono text-white font-bold">85°C</span>
                    <div className="h-32 w-3 rounded-full bg-gradient-to-b from-yellow-300 via-orange-500 via-purple-700 to-slate-950 border border-white/20" />
                    <span className="text-[9px] font-mono text-muted">20°C</span>
                  </div>

                  {/* FLIR Spec Header */}
                  <div className="absolute bottom-16 left-4 font-mono text-[10px] text-orange-400/80 space-y-0.5">
                    <div>[FLIR IR-640 THERMAL MATRIX]</div>
                    <div>ε: 0.95 · S/N: 9481-CAL · FOV: 42°</div>
                  </div>
                </div>
              )}

              {/* INDUSTRIAL LIDAR HUD OVERLAY */}
              {viewMode === 'lidar' && (
                <div className="pointer-events-none absolute inset-0 z-10">
                  <div className="absolute bottom-16 left-4 font-mono text-[10px] text-cyan-400/90 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <ScanLine className="h-3 w-3 text-emerald-400 animate-spin" />
                      <span>AUTONOMOUS LIDAR SLAM V4</span>
                    </div>
                    <div>350,000 pts/sec · λ: 905nm · RES: ±0.01mm</div>
                  </div>
                </div>
              )}

              {/* BOTTOM FLOATING VIEW MODE SWITCHER TOOLBAR */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/85 p-1.5 shadow-2xl backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    play('toggle')
                    setViewMode('standard')
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono transition-all ${
                    viewMode === 'standard'
                      ? 'bg-accent text-accent-fg font-semibold shadow-md'
                      : 'text-muted hover:text-white'
                  }`}
                >
                  <span>🏭 Standard</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    play('toggle')
                    setViewMode('thermal')
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono transition-all ${
                    viewMode === 'thermal'
                      ? 'bg-orange-500 text-white font-semibold shadow-md shadow-orange-500/30'
                      : 'text-muted hover:text-white'
                  }`}
                >
                  <span>🔥 FLIR Thermal</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    play('toggle')
                    setViewMode('lidar')
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono transition-all ${
                    viewMode === 'lidar'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                      : 'text-muted hover:text-white'
                  }`}
                >
                  <span>🌐 LiDAR Scan</span>
                </button>
              </div>
            </div>
          </Panel>

          {/* CONTEXTUAL ASSET TELEMETRY & DIAGNOSTICS CARD */}
          {selectedMachine && (
            <Panel
              title={
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: selectedMachine.color }}
                  />
                  <span className="font-mono text-base font-bold text-ink">
                    {selectedMachine.machine.machine_id}
                  </span>
                  <span className="text-sm font-normal text-muted">— {selectedMachine.machine.name}</span>
                  <Badge
                    severity={
                      severityOf(selectedMachine.status) === 'crit'
                        ? 'crit'
                        : severityOf(selectedMachine.status) === 'warn'
                          ? 'warn'
                          : 'ok'
                    }
                  >
                    {selectedMachine.status}
                  </Badge>
                </div>
              }
              subtitle={
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
                  <span>Facility: <strong className="text-ink">Building 1 (Machining Facility)</strong></span>
                  <span>•</span>
                  <span>Bay: <strong className="text-ink">{selectedMachine.bay}</strong> (Slot {selectedMachine.slot + 1})</span>
                  <span>•</span>
                  <span>Type: <strong className="text-ink">{selectedMachine.machine.category}</strong></span>
                </div>
              }
              right={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBackToPlant}
                    className="flex items-center gap-1.5 rounded-ctl border border-hairline bg-raised px-2.5 py-1.5 text-xs font-mono font-medium text-muted transition-colors hover:border-accent hover:text-ink"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigateToDigitalTwin(selectedMachine.machine.machine_id)}
                    className="flex items-center gap-1.5 rounded-ctl bg-accent px-3 py-1.5 text-xs font-mono font-semibold text-accent-fg shadow transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Inspect Digital Twin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="p-1 text-muted hover:text-ink transition-colors"
                    aria-label="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              }
              bodyClass="p-4"
            >
              <div className="space-y-4">
                {/* Live Telemetry Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  <div className="rounded-lg border border-hairline bg-raised p-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted">Temperature</div>
                    <div className="mt-1 font-mono text-lg font-bold text-ink">
                      {num(live[selectedMachine.machine.machine_id]?.temperature ?? selectedMachine.machine.sensors?.find((s) => s.sensor_type.toLowerCase().includes('temp'))?.last_value ?? 42.5, 1)}
                      <span className="ml-1 text-xs font-normal text-muted">°C</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-hairline bg-raised p-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted">Vibration</div>
                    <div className="mt-1 font-mono text-lg font-bold text-ink">
                      {num(live[selectedMachine.machine.machine_id]?.vibration ?? selectedMachine.machine.sensors?.find((s) => s.sensor_type.toLowerCase().includes('vib'))?.last_value ?? 1.8, 2)}
                      <span className="ml-1 text-xs font-normal text-muted">mm/s</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-hairline bg-raised p-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted">Current</div>
                    <div className="mt-1 font-mono text-lg font-bold text-ink">
                      {num(live[selectedMachine.machine.machine_id]?.current ?? selectedMachine.machine.sensors?.find((s) => s.sensor_type.toLowerCase().includes('curr'))?.last_value ?? 14.2, 1)}
                      <span className="ml-1 text-xs font-normal text-muted">A</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-hairline bg-raised p-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted">Speed</div>
                    <div className="mt-1 font-mono text-lg font-bold text-ink">
                      {num(selectedMachine.machine.rpm ?? 1450, 0)}
                      <span className="ml-1 text-xs font-normal text-muted">RPM</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-hairline bg-raised p-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted">Atmosphere</div>
                    <div className="mt-1 font-mono text-lg font-bold text-ink">
                      {num(live[selectedMachine.machine.machine_id]?.gas ?? selectedMachine.machine.sensors?.find((s) => s.sensor_type.toLowerCase().includes('gas'))?.last_value ?? 12.0, 1)}
                      <span className="ml-1 text-xs font-normal text-muted">PPM</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-hairline bg-raised p-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted">Health Score</div>
                    <div className="mt-1 font-mono text-lg font-bold text-emerald-500">
                      {num(selectedMachine.machine.health_score ?? 94, 0)}%
                    </div>
                  </div>

                  <div className="rounded-lg border border-hairline bg-raised p-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted">Anomaly Score</div>
                    <div
                      className={`mt-1 font-mono text-lg font-bold ${
                        selectedMachine.anomaly >= 80 ? 'text-crit' : selectedMachine.anomaly >= 45 ? 'text-warn' : 'text-ok'
                      }`}
                    >
                      {num(live[selectedMachine.machine.machine_id]?.anomalyScore ?? selectedMachine.anomaly, 1)}
                    </div>
                  </div>

                  <div className="rounded-lg border border-hairline bg-raised p-2.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted">Operating Hrs</div>
                    <div className="mt-1 font-mono text-lg font-bold text-ink">
                      {num(selectedMachine.machine.operating_hours ?? 1240, 0)}
                      <span className="ml-1 text-xs font-normal text-muted">hrs</span>
                    </div>
                  </div>
                </div>

                {/* Subsystem Components / Sensors preview */}
                {selectedMachine.machine.components && selectedMachine.machine.components.length > 0 && (
                  <div className="border-t border-hairline pt-3">
                    <div className="mb-2 text-xs font-mono font-medium text-muted">Monitored Subcomponents:</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {selectedMachine.machine.components.slice(0, 4).map((comp) => (
                        <div
                          key={comp.component_id}
                          className="flex items-center justify-between rounded border border-hairline bg-raised/70 px-2.5 py-1.5 text-xs font-mono"
                        >
                          <span className="truncate text-ink">{comp.name}</span>
                          <span className="ml-2 shrink-0 text-muted">{comp.health_score}% health</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Bay roster — the same live data as a list, and the touch fallback */}
          <div className="grid gap-4 lg:grid-cols-3">
            {BAYS.map((bay) => {
              const inBay = floor.filter((f) => f.bay === bay)
              return (
                <Panel key={bay} title={bay} subtitle={`${inBay.length} assets`} bodyClass="p-3">
                  {inBay.length === 0 ? (
                    <EmptyState label="Bay empty" icon={<Boxes className="h-5 w-5" />} />
                  ) : (
                    <ul className="space-y-2">
                      {inBay.map((f) => {
                        const isSelected = f.machine.machine_id === selectedId
                        return (
                          <li key={f.machine.machine_id}>
                            <button
                              type="button"
                              onClick={() => handleSelectMachine(f.machine.machine_id)}
                              className={`flex w-full min-h-[44px] items-center gap-2.5 rounded-ctl border bg-raised px-3 py-2 text-left transition-all ${
                                isSelected
                                  ? 'border-accent ring-1 ring-accent/60 bg-accent/5'
                                  : 'border-hairline hover:border-accent/40'
                              }`}
                            >
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                  f.beacon === 'strobe'
                                    ? 'animate-beacon-strobe'
                                    : f.beacon === 'blink'
                                      ? 'animate-beacon-blink'
                                      : ''
                                }`}
                                style={{ background: f.color }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="tnum block truncate text-xs text-ink font-semibold">{f.machine.machine_id}</span>
                                <span className="block truncate text-[10px] text-muted">{f.machine.name}</span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className={`block text-[10px] ${severityOf(f.status) === 'crit' ? 'text-crit' : severityOf(f.status) === 'warn' ? 'text-warn' : 'text-ok'}`}>
                                  {f.status}
                                </span>
                                <span className="tnum block text-[10px] text-muted">anom {num(f.anomaly, 1)}</span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Panel>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

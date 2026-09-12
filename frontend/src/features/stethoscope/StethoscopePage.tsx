import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Boxes,
  Layers,
  Pause,
  Play,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'

// Machine Profiles for Sonification
interface MachineProfile {
  id: string
  name: string
  label: string
  category: string
  status: 'NORMAL' | 'WARNING' | 'CRITICAL'
  rpm: number
  freq1X: number
  vibration: number // mm/s
  defectHz: number
  defectType: string
  defectName: string
  defectSeverity: number // %
  dB: string
  wearIndex: number
}

const MACHINES: MachineProfile[] = [
  {
    id: 'Machine-001',
    name: 'Machine-001',
    label: 'High-Precision 5-Axis CNC Mill',
    category: 'CNC_MILL_5AXIS',
    status: 'NORMAL',
    rpm: 6000,
    freq1X: 100.0,
    vibration: 1.62,
    defectHz: 3120,
    defectType: 'Nominal Baseline',
    defectName: 'Spindle Roller Bearing',
    defectSeverity: 12,
    dB: '-38.2 dB',
    wearIndex: 14,
  },
  {
    id: 'Machine-002',
    name: 'Machine-002',
    label: 'Heavy Duty Industrial Lathe & Mill',
    category: 'TURNING_CENTER',
    status: 'WARNING',
    rpm: 3200,
    freq1X: 53.3,
    vibration: 4.38,
    defectHz: 2410,
    defectType: 'Inner Race Spalling (BPFI)',
    defectName: 'Inner Race Spalling',
    defectSeverity: 78,
    dB: '-13.7 dB',
    wearIndex: 62,
  },
  {
    id: 'Machine-003',
    name: 'Machine-003',
    label: 'Robotic Welding Cell Arc-6',
    category: 'ROBOTIC_ARM',
    status: 'NORMAL',
    rpm: 1440,
    freq1X: 24.0,
    vibration: 2.15,
    defectHz: 1850,
    defectType: 'Gear Mesh Tooth Chipping',
    defectName: 'Joint-3 Harmonic Reducer',
    defectSeverity: 22,
    dB: '-31.4 dB',
    wearIndex: 28,
  },
  {
    id: 'Pump-001',
    name: 'Pump-001',
    label: 'Coolant Circulation Centrifugal Pump',
    category: 'CENTRIFUGAL_PUMP',
    status: 'WARNING',
    rpm: 2950,
    freq1X: 49.2,
    vibration: 3.85,
    defectHz: 1980,
    defectType: 'Impeller Vane Cavitation',
    defectName: 'Fluid Cavitation & Erosion',
    defectSeverity: 65,
    dB: '-18.5 dB',
    wearIndex: 54,
  },
  {
    id: 'Motor-001',
    name: 'Motor-001',
    label: '75 kW 3-Phase Induction Main Drive Motor',
    category: 'INDUCTION_MOTOR',
    status: 'NORMAL',
    rpm: 1480,
    freq1X: 24.7,
    vibration: 1.88,
    defectHz: 2150,
    defectType: 'Stator Harmonic Asymmetry',
    defectName: 'Drive-End Bearing Cage',
    defectSeverity: 18,
    dB: '-34.0 dB',
    wearIndex: 19,
  },
  {
    id: 'Compressor-001',
    name: 'Compressor-001',
    label: 'Rotary Screw Air Compressor (10 Bar)',
    category: 'SCREW_COMPRESSOR',
    status: 'NORMAL',
    rpm: 3600,
    freq1X: 60.0,
    vibration: 2.30,
    defectHz: 2840,
    defectType: 'Rotor Lobe Axial Rubbing',
    defectName: 'Male Screw Thrust Bearing',
    defectSeverity: 25,
    dB: '-29.8 dB',
    wearIndex: 31,
  },
]

export default function StethoscopePage() {
  const theme = useSettingsStore((s) => s.theme)
  const isLight = theme === 'light'

  const [selectedId, setSelectedId] = useState('Machine-002')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [focusBand, setFocusBand] = useState<'wide' | 'bearing' | 'shaft'>('wide')
  const [viewAngle, setViewAngle] = useState<'3d' | '2d' | 'top'>('3d')

  const activeMachine = useMemo(
    () => MACHINES.find((m) => m.id === selectedId) || MACHINES[1],
    [selectedId],
  )

  // Live oscillating vibration jitter
  const [liveVib, setLiveVib] = useState(activeMachine.vibration)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPaused) {
        const jitter = (Math.random() - 0.5) * 0.12
        setLiveVib(Number((activeMachine.vibration + jitter).toFixed(2)))
      }
    }, 450)
    return () => clearInterval(timer)
  }, [activeMachine.vibration, isPaused])

  // Canvas Refs
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const timeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fftCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Web Audio Context & Nodes
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const biquadFilterRef = useRef<BiquadFilterNode | null>(null)
  const defectGainRef = useRef<GainNode | null>(null)

  // 3D Viewport Mouse Orbit State
  const [rotX, setRotX] = useState(0.55) // Pitch
  const [rotY, setRotY] = useState(-0.45) // Yaw
  const [zoom, setZoom] = useState(1.0)
  const isDraggingRef = useRef(false)
  const lastMousePosRef = useRef({ x: 0, y: 0 })

  // Initialize / Toggle Audio
  const toggleAudio = () => {
    if (isPlaying) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
        audioCtxRef.current = null
      }
      setIsPlaying(false)
    } else {
      try {
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        audioCtxRef.current = ctx

        // Master Gain
        const master = ctx.createGain()
        master.gain.value = volume
        master.connect(ctx.destination)
        masterGainRef.current = master

        // Filter Node based on Focus Band
        const filter = ctx.createBiquadFilter()
        if (focusBand === 'bearing') {
          filter.type = 'bandpass'
          filter.frequency.value = 2410
          filter.Q.value = 3.5
        } else if (focusBand === 'shaft') {
          filter.type = 'lowpass'
          filter.frequency.value = 500
        } else {
          filter.type = 'allpass'
        }
        filter.connect(master)
        biquadFilterRef.current = filter

        // 1. Motor 1X Fundamental Hum (53.3 Hz harmonic)
        const fundamentalOsc = ctx.createOscillator()
        fundamentalOsc.type = 'sawtooth'
        fundamentalOsc.frequency.setValueAtTime(activeMachine.freq1X * 2, ctx.currentTime)
        const fundamentalGain = ctx.createGain()
        fundamentalGain.gain.value = 0.16
        fundamentalOsc.connect(fundamentalGain)
        fundamentalGain.connect(filter)
        fundamentalOsc.start()

        // 2. High Frequency Bearing Spall Resonance (2410 Hz)
        const defectOsc = ctx.createOscillator()
        defectOsc.type = 'sine'
        defectOsc.frequency.setValueAtTime(activeMachine.defectHz, ctx.currentTime)

        // 3. Amplitude Modulator (Periodic clicking / ball impact rate)
        const lfo = ctx.createOscillator()
        lfo.type = 'square'
        lfo.frequency.setValueAtTime(14.2, ctx.currentTime)
        const lfoGain = ctx.createGain()
        lfoGain.gain.value = 0.5
        lfo.connect(lfoGain.gain)
        lfo.start()

        const defectGain = ctx.createGain()
        defectGain.gain.value = (activeMachine.defectSeverity / 100) * 0.38
        defectOsc.connect(defectGain)
        defectGain.connect(filter)
        defectOsc.start()
        defectGainRef.current = defectGain

        setIsPlaying(true)
      } catch (err) {
        console.error('Audio initialization failed:', err)
      }
    }
  }

  // Update volume & filter dynamically
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(volume, audioCtxRef.current.currentTime)
    }
  }, [volume])

  useEffect(() => {
    if (biquadFilterRef.current && audioCtxRef.current) {
      if (focusBand === 'bearing') {
        biquadFilterRef.current.type = 'bandpass'
        biquadFilterRef.current.frequency.setValueAtTime(2410, audioCtxRef.current.currentTime)
        biquadFilterRef.current.Q.setValueAtTime(3.5, audioCtxRef.current.currentTime)
      } else if (focusBand === 'shaft') {
        biquadFilterRef.current.type = 'lowpass'
        biquadFilterRef.current.frequency.setValueAtTime(500, audioCtxRef.current.currentTime)
      } else {
        biquadFilterRef.current.type = 'allpass'
      }
    }
  }, [focusBand])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
      }
    }
  }, [])

  // --------------------------------------------------------------------------
  // 3D WATERFALL SPECTROGRAM CANVAS ANIMATION (Naval Sonar Terrain)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = waterfallCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let timeStep = 0

    // Slices history (48 rolling slices)
    const numSlices = 46
    const numBins = 72
    const slices: number[][] = []

    // Seed initial spectral slices
    for (let s = 0; s < numSlices; s++) {
      const slice: number[] = []
      for (let b = 0; b < numBins; b++) {
        // Base thermal noise floor
        let val = 0.08 + Math.random() * 0.06
        // Shaft 1X fundamental at low frequencies (bin 2 to 5)
        if (b >= 2 && b <= 4) {
          val += 0.28 + Math.sin(s * 0.4 + b) * 0.08
        }
        // Defect frequency peak around bin 35 (2,410 Hz)
        if (activeMachine.defectSeverity > 30 && Math.abs(b - 35) <= 5) {
          const dist = Math.abs(b - 35)
          const peakHeight = (activeMachine.defectSeverity / 100) * 0.85
          val += (peakHeight / (1 + dist * 0.9)) * (0.8 + Math.random() * 0.35)
        }
        slice.push(val)
      }
      slices.push(slice)
    }

    const render = () => {
      if (!isPaused) {
        timeStep += 1

        // Push new rolling slice at the front, drop the oldest
        const newSlice: number[] = []
        for (let b = 0; b < numBins; b++) {
          let val = 0.08 + Math.random() * 0.06
          if (b >= 2 && b <= 4) {
            val += 0.28 + Math.sin(timeStep * 0.3 + b) * 0.08
          }
          if (activeMachine.defectSeverity > 30 && Math.abs(b - 35) <= 5) {
            const dist = Math.abs(b - 35)
            const peakHeight = (activeMachine.defectSeverity / 100) * 0.85
            val += (peakHeight / (1 + dist * 0.9)) * (0.85 + Math.random() * 0.3)
          }
          newSlice.push(val)
        }
        slices.unshift(newSlice)
        if (slices.length > numSlices) slices.pop()
      }

      const w = canvas.width
      const h = canvas.height

      // Dark Naval Marine Viewport Background
      ctx.fillStyle = '#060c18'
      ctx.fillRect(0, 0, w, h)

      // Perspective transformation parameters
      const cx = w * 0.52
      const cy = h * 0.56
      const scale = 260 * zoom

      // Grid Base Plane Lines
      ctx.strokeStyle = '#0f1d33'
      ctx.lineWidth = 1
      for (let s = 0; s <= numSlices; s += 5) {
        const p0 = project(-1, s / numSlices, 0, rotX, rotY, cx, cy, scale)
        const p1 = project(1, s / numSlices, 0, rotX, rotY, cx, cy, scale)
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
      }
      for (let b = 0; b <= 10; b++) {
        const xRel = (b / 10) * 2 - 1
        const p0 = project(xRel, 0, 0, rotX, rotY, cx, cy, scale)
        const p1 = project(xRel, 1, 0, rotX, rotY, cx, cy, scale)
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
      }

      // Draw Rolling Slices from Back to Front
      for (let s = slices.length - 1; s >= 0; s--) {
        const slice = slices[s]
        const zNorm = s / numSlices // 0 is front, 1 is back

        ctx.beginPath()
        let first = true
        for (let b = 0; b < numBins; b++) {
          const xNorm = (b / (numBins - 1)) * 2 - 1 // -1 to +1
          const yNorm = slice[b] // Amplitude

          const pt = project(xNorm, zNorm, yNorm, rotX, rotY, cx, cy, scale)
          if (first) {
            ctx.moveTo(pt.x, pt.y)
            first = false
          } else {
            ctx.lineTo(pt.x, pt.y)
          }
        }

        // Color gradient: deep blue for normal, golden-orange for defect peak
        const isFaultSlice = activeMachine.defectSeverity > 35
        const strokeColor = isFaultSlice
          ? `rgba(${Math.round(245 - zNorm * 120)}, ${Math.round(158 - zNorm * 80)}, ${Math.round(11 + zNorm * 80)}, ${0.9 - zNorm * 0.5})`
          : `rgba(14, 165, 233, ${0.85 - zNorm * 0.5})`

        ctx.strokeStyle = strokeColor
        ctx.lineWidth = s === 0 ? 2 : 1.2
        ctx.stroke()

        // Fill below slice with darker shaded gradient
        const bottomPt0 = project(1, zNorm, 0, rotX, rotY, cx, cy, scale)
        const bottomPt1 = project(-1, zNorm, 0, rotX, rotY, cx, cy, scale)
        ctx.lineTo(bottomPt0.x, bottomPt0.y)
        ctx.lineTo(bottomPt1.x, bottomPt1.y)
        ctx.closePath()

        ctx.fillStyle = isFaultSlice
          ? `rgba(30, 20, 10, ${0.35 - zNorm * 0.25})`
          : `rgba(6, 20, 36, ${0.4 - zNorm * 0.3})`
        ctx.fill()
      }

      // Draw Vertical Fault Indicator Pin at 2,410 Hz (Bin 35)
      if (activeMachine.defectSeverity > 30) {
        const peakBin = 35
        const xNorm = (peakBin / (numBins - 1)) * 2 - 1
        const zFront = 0.15
        const peakAmp = slices[0] ? slices[0][peakBin] + 0.35 : 0.85

        const basePt = project(xNorm, zFront, 0, rotX, rotY, cx, cy, scale)
        const topPt = project(xNorm, zFront, peakAmp, rotX, rotY, cx, cy, scale)

        // Vertical probe line
        ctx.beginPath()
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2.5
        ctx.moveTo(basePt.x, basePt.y)
        ctx.lineTo(topPt.x, topPt.y)
        ctx.stroke()

        // Probe tip glowing bead
        ctx.beginPath()
        ctx.arc(topPt.x, topPt.y, 4.5, 0, Math.PI * 2)
        ctx.fillStyle = '#fbbf24'
        ctx.fill()
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2
        ctx.stroke()

        // Pulse aura
        ctx.beginPath()
        ctx.arc(topPt.x, topPt.y, 8 + Math.sin(timeStep * 0.2) * 2, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      animId = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(animId)
  }, [activeMachine, isPaused, rotX, rotY, zoom])

  // Helper function for 3D isometric projection
  function project(
    x: number,
    z: number,
    y: number,
    rx: number,
    ry: number,
    cx: number,
    cy: number,
    scale: number,
  ) {
    // Rotation around Y (yaw)
    const cosY = Math.cos(ry)
    const sinY = Math.sin(ry)
    const x1 = x * cosY - z * sinY
    const z1 = x * sinY + z * cosY

    // Rotation around X (pitch)
    const cosX = Math.cos(rx)
    const sinX = Math.sin(rx)
    const y2 = -y * scale + z1 * scale * sinX
    const z2 = z1 * scale * cosX

    return {
      x: cx + x1 * scale * 1.35,
      y: cy + y2,
      depth: z2,
    }
  }

  // --------------------------------------------------------------------------
  // SCOPE 1: TIME-DOMAIN SIGNAL CANVAS ANIMATION (Image 2 - Left)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = timeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let phase = 0

    const render = () => {
      if (!isPaused) phase += 0.12
      const w = canvas.width
      const h = canvas.height

      // Dark background
      ctx.fillStyle = '#060c18'
      ctx.fillRect(0, 0, w, h)

      // Center baseline
      const midY = h / 2
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
      ctx.stroke()
      ctx.setLineDash([])

      // Sinusoidal waveform with harmonic spall micro-clicks
      ctx.beginPath()
      ctx.strokeStyle = '#f59e0b' // Amber/Gold scope trace
      ctx.lineWidth = 2

      const amp = (liveVib / 5.0) * (h * 0.28)
      for (let x = 0; x < w; x++) {
        const t = (x / w) * Math.PI * 8 + phase
        // Fundamental sine wave
        let yVal = Math.sin(t) * amp
        // High frequency harmonic spall vibration
        if (activeMachine.defectSeverity > 30) {
          const spallRipple = Math.sin(t * 12) * (amp * 0.22) * (Math.sin(t * 0.5) > 0 ? 1 : 0.2)
          yVal += spallRipple
        }
        const y = midY + yVal

        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      animId = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(animId)
  }, [activeMachine, liveVib, isPaused])

  // --------------------------------------------------------------------------
  // SCOPE 2: 2D FFT SPECTRAL POWER DENSITY CANVAS (Image 2 - Right)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = fftCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let tick = 0

    const numBars = 48

    const render = () => {
      if (!isPaused) tick += 0.08
      const w = canvas.width
      const h = canvas.height

      ctx.fillStyle = '#060c18'
      ctx.fillRect(0, 0, w, h)

      const barWidth = Math.max(2, (w / numBars) - 2)
      const bottomY = h - 6

      for (let i = 0; i < numBars; i++) {
        const x = i * (w / numBars) + 1

        // Baseline bar height
        let normH = 0.08 + Math.sin(tick + i * 0.2) * 0.03

        // 1X fundamental spike (bars 2 to 4)
        if (i >= 2 && i <= 3) {
          normH = 0.24 + Math.sin(tick * 1.5 + i) * 0.04
        }

        // Defect Peak at 2,410 Hz (around bar 23 to 26)
        const isPeak = Math.abs(i - 24) <= 2
        if (activeMachine.defectSeverity > 30 && isPeak) {
          const peakScale = (activeMachine.defectSeverity / 100) * 0.78
          normH = peakScale + Math.sin(tick * 2 + i) * 0.08
        }

        const barH = normH * (h - 14)

        if (isPeak && activeMachine.defectSeverity > 30) {
          ctx.fillStyle = '#f59e0b' // High fault peak in golden amber
        } else {
          ctx.fillStyle = '#06b6d4' // Normal spectrum in cyan
        }

        ctx.fillRect(x, bottomY - barH, barWidth, barH)
      }

      animId = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(animId)
  }, [activeMachine, isPaused])

  return (
    <div className="space-y-4">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted uppercase tracking-wider mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>OPERATIONS · ACOUSTIC TELEMETRY</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Acoustic Stethoscope</h1>
          <p className="text-xs text-muted mt-0.5 font-medium">
            {activeMachine.label} - Telemetry Sonification & Spectral Waterfall
          </p>
        </div>

        {/* Quick link navigation buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/stress-analysis"
            className="inline-flex items-center gap-1.5 rounded-ctl border border-hairline bg-raised px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-amber-500/50 hover:text-amber-500"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" /> Stress Analysis
          </Link>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-1.5 rounded-ctl border border-hairline bg-raised px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-purple-500/50 hover:text-purple-500"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-500" /> Root Cause
          </Link>
          <Link
            to="/digital-twin"
            className="inline-flex items-center gap-1.5 rounded-ctl border border-hairline bg-raised px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-hairline hover:text-accent"
          >
            <Boxes className="h-3.5 w-3.5" /> Digital Twin
          </Link>
          <Link
            to="/telemetry"
            className="inline-flex items-center gap-1.5 rounded-ctl border border-hairline bg-raised px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-hairline hover:text-accent"
          >
            <Activity className="h-3.5 w-3.5" /> Telemetry
          </Link>
          <Link
            to="/god-view"
            className="inline-flex items-center gap-1.5 rounded-ctl border border-hairline bg-raised px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-hairline hover:text-accent"
          >
            <Layers className="h-3.5 w-3.5" /> Plant Floor
          </Link>
        </div>
      </div>

      {/* 2. DISCLAIMER BANNER */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-ctl border px-3 py-2 text-xs ${
          isLight
            ? 'border-emerald-200 bg-[#eefbf4] text-emerald-900'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
              isLight
                ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
            }`}
          >
            Acoustic Diagnostic Sonification
          </span>
          <span className="text-emerald-950 dark:text-emerald-200">
            Mathematically synthesized from live vibration, rotational speed (RPM), and component wear telemetry.
          </span>
        </div>
        <div className="text-[11px] text-emerald-800 dark:text-emerald-400 font-mono">
          ⓘ Not a physical microphone recording · ISO 10816 acoustic modeling
        </div>
      </div>

      {/* 3. MACHINE SELECTOR ROW */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
            SELECT MACHINE FOR ACOUSTIC SONIFICATION
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {MACHINES.map((m) => {
              const isActive = selectedId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono transition-all ${
                    isActive
                      ? 'border border-emerald-500 bg-emerald-500/15 font-bold text-emerald-800 dark:text-emerald-300 shadow-sm'
                      : 'border border-hairline bg-card text-muted hover:border-hairline hover:text-ink'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span>{m.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="text-xs font-mono font-bold text-muted uppercase">
          ACTIVE ASSET: <span className="text-ink">{activeMachine.name}</span>
        </div>
      </div>

      {/* 4. 6 KPI METRIC CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Metric 1 */}
        <div className="rounded-card border border-hairline bg-card p-3 shadow-panel">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
            ASSET STATUS
          </div>
          <div
            className={`mt-1 text-xl font-bold font-mono ${
              activeMachine.status === 'WARNING'
                ? 'text-amber-500'
                : activeMachine.status === 'CRITICAL'
                  ? 'text-rose-500'
                  : 'text-emerald-500'
            }`}
          >
            {activeMachine.status}
          </div>
          <div className="text-[11px] text-muted font-mono mt-0.5">{activeMachine.category}</div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-card border border-hairline bg-card p-3 shadow-panel">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
            VIBRATION
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-ink">{liveVib}</span>
            <span className="text-xs text-muted font-mono">mm/s</span>
          </div>
          <div className="text-[11px] text-muted mt-0.5">Bearing housing probe</div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-card border border-hairline bg-card p-3 shadow-panel">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
            ROTATIONAL SPEED
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-ink">{activeMachine.rpm}</span>
            <span className="text-xs text-muted font-mono">rpm</span>
          </div>
          <div className="text-[11px] text-muted font-mono mt-0.5">1X: {activeMachine.freq1X} Hz</div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-card border border-hairline bg-card p-3 shadow-panel">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
            1X FUNDAMENTAL
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-ink">{activeMachine.freq1X}</span>
            <span className="text-xs text-muted font-mono">Hz</span>
          </div>
          <div className="text-[11px] text-muted mt-0.5">Rotor shaft velocity</div>
        </div>

        {/* Metric 5 */}
        <div className="rounded-card border border-hairline bg-card p-3 shadow-panel">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
            AUDIO SONIFICATION
          </div>
          <div
            className={`mt-1 text-2xl font-bold font-mono ${
              isPlaying ? 'text-emerald-500' : 'text-ink'
            }`}
          >
            {isPlaying ? 'ACTIVE' : 'MUTED'}
          </div>
          <div className="text-[11px] text-muted mt-0.5">Web Audio API engine</div>
        </div>

        {/* Metric 6 */}
        <div className="rounded-card border border-hairline bg-card p-3 shadow-panel">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
            DIAGNOSTIC SIGNATURE
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-amber-500">
              {activeMachine.defectHz}
            </span>
            <span className="text-xs text-muted font-mono">Hz</span>
          </div>
          <div className="text-[11px] text-muted truncate mt-0.5">{activeMachine.defectType}</div>
        </div>
      </div>

      {/* 5. ACOUSTIC STETHOSCOPE CONTROLS CARD */}
      <div className="rounded-card border border-hairline bg-card p-4 shadow-panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Acoustic Stethoscope Controls</h2>
            <p className="text-xs text-muted mt-0.5">
              Live telemetry audio synthesizer · Activate to listen to mechanical vibration
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>Engine: Streaming Telemetry</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          {/* Audio Action Buttons & Volume */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-ctl border border-hairline bg-raised px-3 text-xs font-medium text-ink shadow-sm transition-colors hover:border-hairline hover:text-accent"
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              onClick={toggleAudio}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-ctl border px-3 text-xs font-semibold shadow-sm transition-colors ${
                isPlaying
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-rose-400/80 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              {isPlaying ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span>{isPlaying ? 'Active (Listening)' : 'Muted'}</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-muted font-mono ml-1">
              <span>Vol</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 accent-accent cursor-pointer"
              />
              <span className="w-8">{Math.round(volume * 100)}%</span>
            </div>
          </div>

          {/* Focus Band Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] font-mono text-muted uppercase">FOCUS BAND:</span>
            <button
              type="button"
              onClick={() => setFocusBand('wide')}
              className={`rounded-ctl px-3 py-1.5 font-medium transition-colors ${
                focusBand === 'wide'
                  ? 'bg-emerald-900 text-white font-semibold shadow-sm'
                  : 'border border-hairline bg-raised text-muted hover:text-ink'
              }`}
            >
              Wideband (0–5 kHz)
            </button>
            <button
              type="button"
              onClick={() => setFocusBand('bearing')}
              className={`rounded-ctl px-3 py-1.5 font-medium transition-colors ${
                focusBand === 'bearing'
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'border border-hairline bg-raised text-muted hover:text-ink'
              }`}
            >
              Bearing Defect (1.5–3.5 kHz)
            </button>
            <button
              type="button"
              onClick={() => setFocusBand('shaft')}
              className={`rounded-ctl px-3 py-1.5 font-medium transition-colors ${
                focusBand === 'shaft'
                  ? 'bg-sky-600 text-white font-semibold shadow-sm'
                  : 'border border-hairline bg-raised text-muted hover:text-ink'
              }`}
            >
              Shaft 1X (0–500 Hz)
            </button>
          </div>
        </div>
      </div>

      {/* 6. ACOUSTIC SIGNATURE DETECTION BANNER */}
      <div
        className={`rounded-card border p-4 shadow-sm transition-colors ${
          activeMachine.defectSeverity > 35
            ? 'border-amber-400/60 bg-[#fffdf5] dark:bg-amber-950/25 dark:border-amber-700/60'
            : 'border-emerald-400/40 bg-emerald-500/5 dark:bg-emerald-950/20'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 ${
                  activeMachine.defectSeverity > 35 ? 'text-amber-500' : 'text-emerald-500'
                }`}
              />
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-amber-600 dark:text-amber-400">
                ACOUSTIC SIGNATURE DETECTION
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  activeMachine.defectSeverity > 35
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-800 dark:text-amber-300'
                    : 'border border-emerald-400 bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {activeMachine.defectSeverity > 35
                  ? 'FAULT SIGNATURE IDENTIFIED'
                  : 'NOMINAL HARMONICS'}
              </span>
            </div>

            <h3 className="text-base font-bold text-ink">{activeMachine.defectName}</h3>
            <p className="text-xs text-muted leading-relaxed">
              Harmonic energy concentrated at {activeMachine.defectHz} Hz with 1X (
              {activeMachine.freq1X} Hz) modulation sidebands. Characterizes localized subsurface
              fatigue spall on the inner bearing raceway.
            </p>
          </div>

          {/* Right Highlight Box */}
          <div className="rounded-ctl border border-amber-300/80 dark:border-amber-800 bg-card p-3 font-mono shadow-sm min-w-[240px] text-right">
            <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
              ACOUSTIC SIGNATURE
            </div>
            <div className="text-xs font-bold text-ink mt-0.5">{activeMachine.defectName}</div>
            <div className="mt-1 flex items-baseline justify-end gap-2">
              <span className="text-xl font-bold text-amber-500">{activeMachine.defectHz} Hz</span>
              <span className="text-xs font-bold text-rose-500">{activeMachine.dB}</span>
            </div>
            <div className="text-[10px] text-muted mt-0.5">
              BPFI harmonic spike · 45.2X Spindle Speed
            </div>
          </div>
        </div>

        {/* 3 Bullets across */}
        <div className="mt-3 grid grid-cols-1 gap-2 pt-3 border-t border-amber-300/40 dark:border-amber-800/40 text-xs text-muted sm:grid-cols-3 font-mono">
          <div>• Prominent acoustic spike identified at {activeMachine.defectHz} Hz (BPFI).</div>
          <div>• Modulation index corresponds to spindle shaft rotation ({activeMachine.freq1X} Hz).</div>
          <div>
            • Bearing wear index at {activeMachine.wearIndex}% requires proactive maintenance
            intervention.
          </div>
        </div>
      </div>

      {/* 7. 3D WATERFALL SPECTROGRAM (Sonar Frequency Time Roll) */}
      <div className="rounded-card border border-slate-800 bg-[#060c18] overflow-hidden shadow-2xl">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 px-4 py-2.5 bg-[#0a1222]">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-white uppercase tracking-wider">
              3D WATERFALL SPECTROGRAM
            </span>
            <span className="text-slate-400">
              {activeMachine.label} [{activeMachine.status}]
            </span>
            <span className="text-[11px] text-slate-500">[ 0 Hz – 5,000 Hz · 48 Rolling Slices ]</span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setViewAngle('3d')}
              className={`rounded px-2.5 py-1 transition-colors ${
                viewAngle === '3d'
                  ? 'bg-slate-700 text-white font-bold border border-slate-600'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3D Iso
            </button>
            <button
              type="button"
              onClick={() => setViewAngle('2d')}
              className={`rounded px-2.5 py-1 transition-colors ${
                viewAngle === '2d'
                  ? 'bg-slate-700 text-white font-bold border border-slate-600'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2D FFT
            </button>
            <button
              type="button"
              onClick={() => setViewAngle('top')}
              className={`rounded px-2.5 py-1 transition-colors ${
                viewAngle === 'top'
                  ? 'bg-slate-700 text-white font-bold border border-slate-600'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Top Map
            </button>
          </div>
        </div>

        {/* 3D Spectrogram Viewport */}
        <div
          className="relative h-[380px] w-full cursor-grab active:cursor-grabbing select-none"
          onMouseDown={(e) => {
            isDraggingRef.current = true
            lastMousePosRef.current = { x: e.clientX, y: e.clientY }
          }}
          onMouseMove={(e) => {
            if (isDraggingRef.current) {
              const dx = e.clientX - lastMousePosRef.current.x
              const dy = e.clientY - lastMousePosRef.current.y
              setRotY((prev) => prev + dx * 0.008)
              setRotX((prev) => Math.max(0.1, Math.min(1.2, prev + dy * 0.008)))
              lastMousePosRef.current = { x: e.clientX, y: e.clientY }
            }
          }}
          onMouseUp={() => {
            isDraggingRef.current = false
          }}
          onMouseLeave={() => {
            isDraggingRef.current = false
          }}
          onWheel={(e) => {
            e.preventDefault()
            setZoom((z) => Math.max(0.6, Math.min(2.0, z - e.deltaY * 0.001)))
          }}
        >
          <canvas
            ref={waterfallCanvasRef}
            width={1200}
            height={480}
            className="h-full w-full object-cover"
          />

          {/* Floating HUD Card: Acoustic Signature */}
          <div className="absolute top-3 right-3 z-10 rounded-lg border border-amber-500/40 bg-slate-950/85 p-3 font-mono text-right shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase text-amber-400">
              <span>✦</span>
              <span>ACOUSTIC SIGNATURE</span>
            </div>
            <div className="text-xs font-bold text-white mt-0.5">{activeMachine.defectName}</div>
            <div className="text-sm font-bold text-amber-400 mt-1">
              {activeMachine.defectHz} Hz{' '}
              <span className="text-xs text-rose-400 font-semibold">{activeMachine.dB} (Elevated)</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Asset: Main Spindle Bearing B-201
            </div>
          </div>

          {/* Bottom Frequency Scale Axis */}
          <div className="absolute bottom-6 left-3 right-3 flex justify-between font-mono text-[10px] text-slate-400 px-2 pointer-events-none">
            <span>0 Hz</span>
            <span>1,000 Hz</span>
            <span className="text-amber-400 font-bold">
              ▲ {activeMachine.defectHz} Hz (FAULT)
            </span>
            <span>3,000 Hz</span>
            <span>4,000 Hz</span>
            <span>5,000 Hz</span>
          </div>

          {/* Bottom Status & Drag Prompt */}
          <div className="absolute bottom-1.5 left-3 right-3 flex items-center justify-between font-mono text-[10px] text-slate-500 pointer-events-none">
            <div>
              TIME: T - 0.0s → T - 2.4s &nbsp;&nbsp;|&nbsp;&nbsp; SPEED: {activeMachine.freq1X} Hz (1X)
            </div>
            <div>Click & drag to rotate 3D view · Scroll to zoom</div>
          </div>
        </div>
      </div>

      {/* 8. TWO BOTTOM REAL-TIME OSCILLOSCOPE SCOPES (Image 2) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left Scope: Time-Domain Signal */}
        <div className="rounded-card border border-slate-800 bg-[#060c18] p-3 shadow-panel">
          <div className="flex items-center justify-between font-mono text-xs text-slate-300 mb-2 border-b border-slate-800/80 pb-1.5">
            <span className="font-semibold text-white">Time-Domain Signal (Probe AC Voltage)</span>
            <span className="text-[11px] text-slate-400">10 mv/div</span>
          </div>
          <div className="relative h-28 w-full overflow-hidden rounded bg-[#040810] border border-slate-800/60">
            <canvas ref={timeCanvasRef} width={600} height={120} className="h-full w-full" />
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>T - 0 ms</span>
            <span className="font-semibold text-amber-400">Vib: {liveVib} mm/s RMS</span>
            <span>T + 100 ms</span>
          </div>
        </div>

        {/* Right Scope: 2D FFT Spectral Power Density */}
        <div className="rounded-card border border-slate-800 bg-[#060c18] p-3 shadow-panel">
          <div className="flex items-center justify-between font-mono text-xs text-slate-300 mb-2 border-b border-slate-800/80 pb-1.5">
            <span className="font-semibold text-white">2D FFT Spectral Power Density</span>
            <span className="text-[11px] text-amber-400 font-bold">
              ▲ {activeMachine.defectHz} Hz (Inner Race Peak)
            </span>
          </div>
          <div className="relative h-28 w-full overflow-hidden rounded bg-[#040810] border border-slate-800/60">
            <canvas ref={fftCanvasRef} width={600} height={120} className="h-full w-full" />
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>0 Hz</span>
            <span>1X: {activeMachine.freq1X} Hz</span>
            <span>2.5 kHz</span>
            <span>5 kHz</span>
          </div>
        </div>
      </div>
    </div>
  )
}

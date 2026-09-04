import { useEffect, useRef } from 'react'
import { api } from '@/lib/apiClient'
import { telemetrySockets } from '@/lib/wsManager'
import { useAlertStore } from '@/store/alertStore'
import { useAuthStore } from '@/store/authStore'
import { useSound } from '@/hooks/useSound'
import { useMachines, useSafetyRules, useSafetyStatus } from '@/hooks/useApi'
import type { TelemetryPoint } from '@/types/api'

/**
 * Plant-wide live watch, mounted once by the app shell.
 *
 * Opens one telemetry socket per machine (shared through the WS manager) so the
 * God View beacons, the war-room trigger and the audio alarm all react to the
 * same real stream rather than to whichever page happens to be open.
 */
export function usePlantWatch() {
  const canReadTelemetry = useAuthStore((s) => s.permissions.includes('telemetry:read'))
  const canReadMachines = useAuthStore((s) => s.permissions.includes('machines:read'))
  const canReadSafety = useAuthStore((s) => s.permissions.includes('safety:read'))

  const { data: machines } = useMachines(canReadMachines)
  const { data: safetyStatus } = useSafetyStatus(canReadSafety)
  const { data: rules } = useSafetyRules(canReadSafety)

  const ingest = useAlertStore((s) => s.ingest)
  const seedHistory = useAlertStore((s) => s.seedHistory)
  const setSystemState = useAlertStore((s) => s.setSystemState)
  const setRules = useAlertStore((s) => s.setRules)

  const seeded = useRef<Set<string>>(new Set())

  // Feed the safety engine's aggregate state into the alert store.
  useEffect(() => {
    if (safetyStatus) setSystemState(safetyStatus.system_safety_state)
  }, [safetyStatus, setSystemState])

  useEffect(() => {
    if (rules) setRules(rules)
  }, [rules, setRules])

  // Seed each machine's chart with real history before the socket fills in.
  useEffect(() => {
    if (!machines || !canReadTelemetry) return
    machines.forEach((m) => {
      if (seeded.current.has(m.machine_id)) return
      seeded.current.add(m.machine_id)
      api
        .get<TelemetryPoint[]>(`/api/machines/${m.machine_id}/history?limit=30`)
        .then((points) => {
          if (Array.isArray(points) && points.length) seedHistory(m.machine_id, points)
        })
        .catch(() => {
          // A machine with no recorded history yet is normal; the socket fills it.
          seeded.current.delete(m.machine_id)
        })
    })
  }, [machines, canReadTelemetry, seedHistory])

  // One shared socket per machine.
  useEffect(() => {
    if (!machines || !canReadTelemetry) return
    const unsubscribes = machines.map((m) =>
      telemetrySockets.subscribe(m.machine_id, (point) => ingest(m.machine_id, point)),
    )
    return () => unsubscribes.forEach((fn) => fn())
  }, [machines, canReadTelemetry, ingest])
}

/**
 * Drives the klaxon from the live emergency state and speaks the banner once
 * per event. Kept separate from detection so muting never affects detection.
 */
export function useEmergencyAudio() {
  const emergency = useAlertStore((s) => s.emergency)
  const { startAlarm, stopAlarm, speak, muted } = useSound()
  const spokenFor = useRef<string | null>(null)

  useEffect(() => {
    if (!emergency) {
      stopAlarm()
      spokenFor.current = null
      return
    }
    if (muted) {
      stopAlarm()
      return
    }
    startAlarm()
    const key = `${emergency.machineId}:${emergency.since}`
    if (spokenFor.current !== key) {
      spokenFor.current = key
      speak(`Warning. ${emergency.machineId} ${emergency.reason}.`)
    }
  }, [emergency, muted, startAlarm, stopAlarm, speak])

  useEffect(() => () => stopAlarm(), [stopAlarm])
}

/**
 * Projects seconds-to-seizure from the live trend and the real safety rules.
 *
 * Fits a least-squares slope over the recent window for the breaching
 * parameter and returns the time until it crosses the configured threshold.
 * Returns null when the trend is flat or improving — no invented urgency.
 */
export function useSeizureProjection(machineId: string | null, parameter: 'temperature' | 'gas' | 'system'): number | null {
  const history = useAlertStore((s) => (machineId ? s.history[machineId] : undefined))
  const rules = useAlertStore((s) => s.rules)

  if (!machineId || !history || history.length < 4) return null

  const param = parameter === 'system' ? 'temperature' : parameter
  const window = history.slice(-12)
  const t0 = new Date(window[0].timestamp).getTime()

  const samples = window
    .map((p) => ({ t: (new Date(p.timestamp).getTime() - t0) / 1000, v: Number(p[param]) }))
    .filter((s) => Number.isFinite(s.t) && Number.isFinite(s.v))

  if (samples.length < 4) return null

  // Median of consecutive rates, not a least-squares fit: injecting a scenario
  // steps the value tens of degrees between two frames, and a least-squares
  // slope reads that one discontinuity as a runaway trend. The median ignores it.
  const rates: number[] = []
  for (let i = 1; i < samples.length; i += 1) {
    const dt = samples[i].t - samples[i - 1].t
    if (dt > 0) rates.push((samples[i].v - samples[i - 1].v) / dt)
  }
  if (rates.length < 3) return null

  rates.sort((a, b) => a - b)
  const mid = Math.floor(rates.length / 2)
  const slope = rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid]
  if (slope <= 0.001) return null // stable or cooling

  // Prefer the plant's own configured trip threshold for this parameter.
  const matching = rules
    .filter((r) => r.is_active && r.parameter?.toLowerCase().includes(param) && r.threshold > 0)
    .sort((a, b) => a.threshold - b.threshold)

  const seizureThreshold = matching.length
    ? Math.max(...matching.map((r) => r.threshold)) * 1.08
    : param === 'temperature'
      ? 110
      : 65

  const current = samples[samples.length - 1].v
  if (current >= seizureThreshold) return 0

  const seconds = (seizureThreshold - current) / slope
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) return null
  return seconds
}

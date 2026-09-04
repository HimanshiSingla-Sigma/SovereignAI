import { create } from 'zustand'
import type { SafetyRule, SafetyState, TelemetryPoint } from '@/types/api'
import { worstState } from '@/lib/format'

/** Hard emergency thresholds, per the plant's fixed interlock spec. */
export const EMERGENCY_TEMP_C = 95
export const EMERGENCY_GAS_PPM = 50

export interface MachineLive {
  machineId: string
  temperature: number
  vibration: number
  current: number
  gas: number
  anomalyScore: number
  status: string
  at: number
}

export interface EmergencyContext {
  machineId: string
  /** Human-readable cause, e.g. "temperature exceeded threshold (97.4 °C > 95 °C)". */
  reason: string
  parameter: 'temperature' | 'gas' | 'system'
  value: number
  threshold: number
  since: number
}

interface AlertState {
  live: Record<string, MachineLive>
  history: Record<string, TelemetryPoint[]>
  systemState: SafetyState
  rules: SafetyRule[]
  emergency: EmergencyContext | null
  /** Set when the operator dismisses the war-room banner for the current event. */
  acknowledgedFor: string | null

  ingest: (machineId: string, point: TelemetryPoint) => void
  seedHistory: (machineId: string, points: TelemetryPoint[]) => void
  setSystemState: (state: SafetyState) => void
  setRules: (rules: SafetyRule[]) => void
  acknowledge: () => void
  reset: () => void
}

const HISTORY_LIMIT = 60

function emergencyFromPoint(machineId: string, p: TelemetryPoint): EmergencyContext | null {
  if (p.temperature > EMERGENCY_TEMP_C) {
    return {
      machineId,
      parameter: 'temperature',
      value: p.temperature,
      threshold: EMERGENCY_TEMP_C,
      reason: `temperature exceeded threshold (${p.temperature.toFixed(1)} °C > ${EMERGENCY_TEMP_C} °C)`,
      since: Date.now(),
    }
  }
  if (p.gas > EMERGENCY_GAS_PPM) {
    return {
      machineId,
      parameter: 'gas',
      value: p.gas,
      threshold: EMERGENCY_GAS_PPM,
      reason: `combustible gas exceeded threshold (${p.gas.toFixed(1)} ppm > ${EMERGENCY_GAS_PPM} ppm)`,
      since: Date.now(),
    }
  }
  return null
}

export const useAlertStore = create<AlertState>((set, get) => ({
  live: {},
  history: {},
  systemState: 'NORMAL',
  rules: [],
  emergency: null,
  acknowledgedFor: null,

  ingest(machineId, point) {
    const prev = get()
    const nextHistory = [...(prev.history[machineId] ?? []), point].slice(-HISTORY_LIMIT)

    const detected = emergencyFromPoint(machineId, point)
    let emergency = prev.emergency

    if (detected) {
      // Keep the original `since` while the same machine stays in emergency so
      // the war-room countdown does not restart on every frame.
      emergency =
        prev.emergency && prev.emergency.machineId === machineId && prev.emergency.parameter === detected.parameter
          ? { ...prev.emergency, value: detected.value, reason: detected.reason }
          : detected
    } else if (prev.emergency?.machineId === machineId && prev.systemState !== 'EMERGENCY') {
      emergency = null
    }

    set({
      live: {
        ...prev.live,
        [machineId]: {
          machineId,
          temperature: point.temperature,
          vibration: point.vibration,
          current: point.current,
          gas: point.gas,
          anomalyScore: point.anomaly_score,
          status: point.machine_status ?? 'OPERATIONAL',
          at: Date.now(),
        },
      },
      history: { ...prev.history, [machineId]: nextHistory },
      emergency,
      acknowledgedFor: emergency ? prev.acknowledgedFor : null,
    })
  },

  seedHistory(machineId, points) {
    set((prev) => ({ history: { ...prev.history, [machineId]: points.slice(-HISTORY_LIMIT) } }))
  },

  setSystemState(state) {
    const prev = get()
    let emergency = prev.emergency

    if (state === 'EMERGENCY' && !emergency) {
      // The safety engine tripped without a local telemetry breach — surface the
      // worst machine we currently observe as the subject of the war room.
      const worst = Object.values(prev.live).sort((a, b) => b.anomalyScore - a.anomalyScore)[0]
      emergency = {
        machineId: worst?.machineId ?? 'PLANT',
        parameter: 'system',
        value: worst?.anomalyScore ?? 100,
        threshold: 0,
        reason: 'deterministic safety engine declared system state EMERGENCY',
        since: Date.now(),
      }
    } else if (state !== 'EMERGENCY' && emergency?.parameter === 'system') {
      emergency = null
    }

    set({
      systemState: worstState(state, 'NORMAL'),
      emergency,
      acknowledgedFor: emergency ? prev.acknowledgedFor : null,
    })
  },

  setRules(rules) {
    set({ rules })
  },

  acknowledge() {
    const em = get().emergency
    set({ acknowledgedFor: em ? `${em.machineId}:${em.since}` : null })
  },

  reset() {
    set({ live: {}, history: {}, systemState: 'NORMAL', emergency: null, acknowledgedFor: null })
  },
}))

/** True when the war-room overlay should currently be shown. */
export function useEmergencyActive(): boolean {
  return useAlertStore((s) => {
    if (!s.emergency) return false
    return s.acknowledgedFor !== `${s.emergency.machineId}:${s.emergency.since}`
  })
}

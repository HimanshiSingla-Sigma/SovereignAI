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

export interface WhatIfOverride {
  machineId: string
  active: boolean
  status: string
  anomalyScore: number
  temperature: number
  vibration: number
  current?: number
  gas?: number
  safetyFactor?: number
  peakStress?: number
  reason?: string
}

interface AlertState {
  live: Record<string, MachineLive>
  history: Record<string, TelemetryPoint[]>
  systemState: SafetyState
  rules: SafetyRule[]
  emergency: EmergencyContext | null
  /** Set when the operator dismisses the war-room banner for the current event. */
  acknowledgedFor: string | null
  whatIfOverrides: Record<string, WhatIfOverride>

  ingest: (machineId: string, point: TelemetryPoint) => void
  seedHistory: (machineId: string, points: TelemetryPoint[]) => void
  setSystemState: (state: SafetyState) => void
  setRules: (rules: SafetyRule[]) => void
  setWhatIfOverride: (override: WhatIfOverride | null, clearMachineId?: string) => void
  clearWhatIfOverride: (machineId: string) => void
  executeShutdown: (machineId: string) => void
  clearEmergency: () => void
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
  whatIfOverrides: {},

  ingest(machineId, point) {
    const prev = get()
    const nextHistory = [...(prev.history[machineId] ?? []), point].slice(-HISTORY_LIMIT)

    const override = prev.whatIfOverrides[machineId]
    if (override && override.active) {
      // If a what-if simulation override is currently active for this machine,
      // preserve the overridden status, anomaly and temperature in live state.
      set({
        history: { ...prev.history, [machineId]: nextHistory },
      })
      return
    }

    const detected = emergencyFromPoint(machineId, point)
    let emergency = prev.emergency

    if (detected) {
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

  setWhatIfOverride(override, clearMachineId) {
    const prev = get()
    const targetId = override?.machineId ?? clearMachineId
    if (!targetId) return

    if (!override || !override.active) {
      // Clear override for this machine
      const nextOverrides = { ...prev.whatIfOverrides }
      delete nextOverrides[targetId]

      // Restore nominal status
      const existing = prev.live[targetId]
      const restoredLive: MachineLive = existing
        ? {
            ...existing,
            status: 'OPERATIONAL',
            anomalyScore: 8.0,
            temperature: 42.0,
            vibration: 1.2,
            at: Date.now(),
          }
        : {
            machineId: targetId,
            temperature: 42.0,
            vibration: 1.2,
            current: 24.0,
            gas: 5.0,
            anomalyScore: 8.0,
            status: 'OPERATIONAL',
            at: Date.now(),
          }

      const emergency = prev.emergency?.machineId === targetId ? null : prev.emergency

      set({
        whatIfOverrides: nextOverrides,
        live: { ...prev.live, [targetId]: restoredLive },
        emergency,
      })
      return
    }

    // Set active override
    const nextOverrides = { ...prev.whatIfOverrides, [targetId]: override }
    const updatedLive: MachineLive = {
      machineId: targetId,
      temperature: override.temperature,
      vibration: override.vibration,
      current: override.current ?? 48.0,
      gas: override.gas ?? 6.0,
      anomalyScore: override.anomalyScore,
      status: override.status,
      at: Date.now(),
    }

    let emergency = prev.emergency
    if (override.status === 'CRITICAL' || override.temperature > EMERGENCY_TEMP_C) {
      emergency = {
        machineId: targetId,
        parameter: 'temperature',
        value: override.temperature,
        threshold: EMERGENCY_TEMP_C,
        reason: override.reason ?? `${targetId} FEA stress threshold breach: critical structural overload`,
        since: Date.now(),
      }
    } else if (prev.emergency?.machineId === targetId && override.status !== 'CRITICAL') {
      emergency = null
    }

    set({
      whatIfOverrides: nextOverrides,
      live: { ...prev.live, [targetId]: updatedLive },
      emergency,
    })
  },

  clearWhatIfOverride(machineId) {
    get().setWhatIfOverride(null, machineId)
  },

  executeShutdown(machineId) {
    const prev = get()
    // 1. Delete what-if override for this machine
    const nextOverrides = { ...prev.whatIfOverrides }
    delete nextOverrides[machineId]

    // 2. Transition machine to SHUTDOWN status with 0 anomaly, cold temp, 0 vibration
    const existing = prev.live[machineId]
    const shutdownLive: MachineLive = {
      ...(existing || { machineId, at: Date.now() }),
      machineId,
      status: 'SHUTDOWN',
      temperature: 24.0,
      vibration: 0.0,
      current: 0.0,
      gas: 2.0,
      anomalyScore: 0.0,
      at: Date.now(),
    }

    // 3. Clear emergency if it belongs to this machine
    const emergency = prev.emergency?.machineId === machineId ? null : prev.emergency

    set({
      whatIfOverrides: nextOverrides,
      live: {
        ...prev.live,
        [machineId]: shutdownLive,
      },
      emergency,
      acknowledgedFor: null,
      systemState: emergency ? 'EMERGENCY' : 'NORMAL',
    })
  },

  clearEmergency() {
    set({ emergency: null, acknowledgedFor: null })
  },

  seedHistory(machineId, points) {
    set((prev) => ({ history: { ...prev.history, [machineId]: points.slice(-HISTORY_LIMIT) } }))
  },

  setSystemState(state) {
    const prev = get()
    let emergency = prev.emergency

    if (state === 'EMERGENCY' && !emergency) {
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
    set({ live: {}, history: {}, systemState: 'NORMAL', emergency: null, acknowledgedFor: null, whatIfOverrides: {} })
  },
}))

/** True when the war-room overlay should currently be shown. */
export function useEmergencyActive(): boolean {
  return useAlertStore((s) => {
    if (!s.emergency) return false
    return s.acknowledgedFor !== `${s.emergency.machineId}:${s.emergency.since}`
  })
}

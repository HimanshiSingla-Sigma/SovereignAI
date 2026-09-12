import type { MachineResponse } from '@/types/api'
import type { MachineLive } from '@/store/alertStore'

export type BayName = 'CNC Line' | 'Bay A' | 'Bay B'

export const BAYS: BayName[] = ['CNC Line', 'Bay A', 'Bay B']

/** Assets are grouped onto the floor by what they are, not by list order. */
export function bayOf(machine: MachineResponse): BayName {
  switch (machine.category) {
    case 'CNC_MILL':
    case 'TURNING_CENTER':
      return 'CNC Line'
    case 'ROBOTIC_CELL':
    case 'COMPRESSOR':
      return 'Bay A'
    default:
      return 'Bay B'
  }
}

export type BeaconMode = 'steady' | 'blink' | 'strobe'

export interface FloorMachine {
  machine: MachineResponse
  bay: BayName
  /** Slot within the bay row. */
  slot: number
  status: string
  anomaly: number
  beacon: BeaconMode
  color: string
}

const GREEN = '#3fb950'
const AMBER = '#d29922'
const RED = '#f85149'

/**
 * Beacon behaviour is driven by the live stream when a frame has arrived and
 * by the REST snapshot otherwise: green steady, amber blinking, red strobing.
 */
export function beaconFor(status: string, anomaly: number): { beacon: BeaconMode; color: string } {
  const s = status.toUpperCase()
  if (s === 'SHUTDOWN') {
    return { beacon: 'steady', color: '#64748b' } // De-energized safe state
  }
  if (['CRITICAL', 'EMERGENCY', 'FAILURE'].includes(s) || anomaly >= 80) {
    return { beacon: 'strobe', color: RED }
  }
  if (['WARNING', 'DEGRADED'].includes(s) || anomaly >= 45) {
    return { beacon: 'blink', color: AMBER }
  }
  return { beacon: 'steady', color: GREEN }
}

export function buildFloor(machines: MachineResponse[], live: Record<string, MachineLive>): FloorMachine[] {
  const counters = new Map<BayName, number>()

  return machines.map((machine) => {
    const bay = bayOf(machine)
    const slot = counters.get(bay) ?? 0
    counters.set(bay, slot + 1)

    const l = live[machine.machine_id]
    const status = l?.status ?? machine.status
    const anomaly = l?.anomalyScore ?? machine.anomaly_score
    const { beacon, color } = beaconFor(status, anomaly)

    return { machine, bay, slot, status, anomaly, beacon, color }
  })
}

import type { MachineResponse } from '@/types/api'

/**
 * Default asset selection.
 *
 * An operator opening the console cares about the machine that is actually
 * misbehaving, so the default is the worst-scoring asset rather than the first
 * one the API happened to return. Ties fall back to machine id for stability.
 */
export function pickDefaultMachine(machines: MachineResponse[] | undefined): string | null {
  if (!machines || machines.length === 0) return null
  const ranked = [...machines].sort((a, b) => {
    if (b.anomaly_score !== a.anomaly_score) return b.anomaly_score - a.anomaly_score
    if (a.health_score !== b.health_score) return a.health_score - b.health_score
    return a.machine_id.localeCompare(b.machine_id)
  })
  return ranked[0].machine_id
}

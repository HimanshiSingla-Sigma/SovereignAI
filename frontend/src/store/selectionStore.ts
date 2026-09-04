import { create } from 'zustand'

interface SelectionState {
  machineId: string | null
  /** Set when God View zooms into a machine, so the twin can play an intro. */
  zoomedFrom: 'god-view' | null
  select: (machineId: string, from?: 'god-view') => void
  clearZoom: () => void
}

/** The machine currently under inspection, shared across twin/telemetry/analytics. */
export const useSelectionStore = create<SelectionState>((set) => ({
  machineId: null,
  zoomedFrom: null,
  select: (machineId, from) => set({ machineId, zoomedFrom: from ?? null }),
  clearZoom: () => set({ zoomedFrom: null }),
}))

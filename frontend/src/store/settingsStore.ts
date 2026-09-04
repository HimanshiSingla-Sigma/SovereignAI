import { create } from 'zustand'

export type PerfMode = 'full' | 'lite'

const KEY = 'siaw.settings'

interface Persisted {
  perfMode: PerfMode
  muted: boolean
}

interface SettingsState extends Persisted {
  setPerfMode: (mode: PerfMode) => void
  togglePerfMode: () => void
  setMuted: (muted: boolean) => void
  toggleMuted: () => void
}

function load(): Persisted {
  const fallback: Persisted = { perfMode: 'full', muted: false }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Persisted>
    return {
      perfMode: parsed.perfMode === 'lite' ? 'lite' : 'full',
      muted: Boolean(parsed.muted),
    }
  } catch {
    return fallback
  }
}

function persist(state: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / private mode */
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...load(),

  setPerfMode(perfMode) {
    set({ perfMode })
    persist({ perfMode, muted: get().muted })
  },
  togglePerfMode() {
    get().setPerfMode(get().perfMode === 'full' ? 'lite' : 'full')
  },
  setMuted(muted) {
    set({ muted })
    persist({ perfMode: get().perfMode, muted })
  },
  toggleMuted() {
    get().setMuted(!get().muted)
  },
}))

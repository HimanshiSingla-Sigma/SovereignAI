import { create } from 'zustand'

export type PerfMode = 'full' | 'lite'
export type Theme = 'dark' | 'light'

const KEY = 'siaw.settings'

interface Persisted {
  perfMode: PerfMode
  muted: boolean
  theme: Theme
}

interface SettingsState extends Persisted {
  setPerfMode: (mode: PerfMode) => void
  togglePerfMode: () => void
  setMuted: (muted: boolean) => void
  toggleMuted: () => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.remove('dark')
    root.classList.add('light')
    root.style.colorScheme = 'light'
  } else {
    root.classList.remove('light')
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  }
}

function load(): Persisted {
  const fallback: Persisted = { perfMode: 'full', muted: false, theme: 'dark' }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      applyTheme('dark')
      return fallback
    }
    const parsed = JSON.parse(raw) as Partial<Persisted>
    const theme: Theme = parsed.theme === 'light' ? 'light' : 'dark'
    applyTheme(theme)
    return {
      perfMode: parsed.perfMode === 'lite' ? 'lite' : 'full',
      muted: Boolean(parsed.muted),
      theme,
    }
  } catch {
    applyTheme('dark')
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
    persist({ perfMode, muted: get().muted, theme: get().theme })
  },
  togglePerfMode() {
    get().setPerfMode(get().perfMode === 'full' ? 'lite' : 'full')
  },
  setMuted(muted) {
    set({ muted })
    persist({ perfMode: get().perfMode, muted, theme: get().theme })
  },
  toggleMuted() {
    get().setMuted(!get().muted)
  },
  setTheme(theme) {
    applyTheme(theme)
    set({ theme })
    persist({ perfMode: get().perfMode, muted: get().muted, theme })
  },
  toggleTheme() {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
  },
}))

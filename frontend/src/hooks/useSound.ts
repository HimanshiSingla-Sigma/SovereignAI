import { useCallback, useEffect } from 'react'
import { audioEngine, type Cue } from '@/lib/audioEngine'
import { useSettingsStore } from '@/store/settingsStore'

/**
 * Access to the synthesized industrial FX.
 *
 * The AudioContext cannot start before a user gesture, so a one-time
 * document-level listener unlocks it on the first pointer/key event.
 */
export function useSound() {
  const muted = useSettingsStore((s) => s.muted)

  useEffect(() => {
    audioEngine.setMuted(muted)
  }, [muted])

  const play = useCallback((cue: Cue) => {
    audioEngine.play(cue)
  }, [])

  const startAlarm = useCallback(() => audioEngine.startAlarm(), [])
  const stopAlarm = useCallback(() => audioEngine.stopAlarm(), [])
  const speak = useCallback((text: string) => audioEngine.speak(text), [])

  return { play, startAlarm, stopAlarm, speak, muted }
}

/** Mounted once at the app root. */
export function useAudioUnlock() {
  useEffect(() => {
    const unlock = () => {
      if (audioEngine.unlock()) {
        window.removeEventListener('pointerdown', unlock)
        window.removeEventListener('keydown', unlock)
      }
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
}

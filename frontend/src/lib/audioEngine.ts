/**
 * Industrial sound FX, synthesized entirely in the browser.
 *
 * Zero audio files, zero network: every effect is built from OscillatorNode,
 * GainNode, BiquadFilterNode and procedurally generated noise buffers, which is
 * what makes it viable inside an air-gapped plant.
 *
 * The AudioContext is created lazily on the first user gesture — browsers
 * suspend contexts created before one.
 */

type Cue = 'click' | 'toggle' | 'alarmStart' | 'hydraulic' | 'denied'

class IndustrialAudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  /** Nodes for the continuously running klaxon, kept so it can be stopped. */
  private alarm: { drone: OscillatorNode; sub: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null
  private klaxonTimer: number | null = null

  private muted = false

  get unlocked() {
    return this.ctx !== null
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.05)
    }
    if (muted) this.stopAlarm()
  }

  /** Must be called from inside a user-gesture handler. */
  unlock(): boolean {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return true
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return false
    try {
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.9
      this.master.connect(this.ctx.destination)
      this.noiseBuffer = this.buildNoiseBuffer(this.ctx)
      return true
    } catch {
      this.ctx = null
      return false
    }
  }

  /** One second of white noise, reused for every transient. */
  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private noiseBurst(opts: { at: number; duration: number; gain: number; type: BiquadFilterType; freq: number; q?: number }) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = opts.type
    filter.frequency.value = opts.freq
    if (opts.q) filter.Q.value = opts.q
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.0001, opts.at)
    env.gain.exponentialRampToValueAtTime(opts.gain, opts.at + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.duration)
    src.connect(filter).connect(env).connect(this.master)
    src.start(opts.at)
    src.stop(opts.at + opts.duration + 0.02)
  }

  private tone(opts: {
    at: number
    duration: number
    freq: number
    endFreq?: number
    gain: number
    type?: OscillatorType
  }) {
    if (!this.ctx || !this.master) return
    const osc = this.ctx.createOscillator()
    osc.type = opts.type ?? 'square'
    osc.frequency.setValueAtTime(opts.freq, opts.at)
    if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, opts.at + opts.duration)
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.0001, opts.at)
    env.gain.exponentialRampToValueAtTime(opts.gain, opts.at + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.duration)
    osc.connect(env).connect(this.master)
    osc.start(opts.at)
    osc.stop(opts.at + opts.duration + 0.02)
  }

  play(cue: Cue) {
    if (this.muted || !this.ctx || !this.master) return
    const t = this.ctx.currentTime

    switch (cue) {
      // Dry electromechanical relay contact.
      case 'click':
        this.noiseBurst({ at: t, duration: 0.035, gain: 0.28, type: 'bandpass', freq: 2600, q: 1.4 })
        this.tone({ at: t, duration: 0.03, freq: 1500, endFreq: 620, gain: 0.14, type: 'square' })
        break

      // Heavier two-stage contactor throw for mode switches.
      case 'toggle':
        this.noiseBurst({ at: t, duration: 0.04, gain: 0.3, type: 'bandpass', freq: 1900, q: 1.1 })
        this.noiseBurst({ at: t + 0.055, duration: 0.05, gain: 0.22, type: 'lowpass', freq: 900 })
        this.tone({ at: t + 0.055, duration: 0.05, freq: 340, endFreq: 150, gain: 0.16, type: 'triangle' })
        break

      // Pneumatic release then metal seat: "psssh-clank".
      case 'hydraulic':
        this.noiseBurst({ at: t, duration: 0.42, gain: 0.3, type: 'highpass', freq: 1500 })
        this.noiseBurst({ at: t + 0.44, duration: 0.09, gain: 0.4, type: 'bandpass', freq: 850, q: 2.2 })
        this.tone({ at: t + 0.44, duration: 0.22, freq: 420, endFreq: 120, gain: 0.22, type: 'triangle' })
        this.tone({ at: t + 0.45, duration: 0.3, freq: 1180, endFreq: 900, gain: 0.1, type: 'sine' })
        break

      // Rejected / unauthorized action.
      case 'denied':
        this.tone({ at: t, duration: 0.12, freq: 240, gain: 0.2, type: 'square' })
        this.tone({ at: t + 0.16, duration: 0.18, freq: 165, gain: 0.2, type: 'square' })
        break

      case 'alarmStart':
        this.startAlarm()
        break
    }
  }

  /** Sub-bass drone + repeating two-tone klaxon, runs until stopAlarm(). */
  startAlarm() {
    if (this.muted || !this.ctx || !this.master || this.alarm) return
    const ctx = this.ctx
    const t = ctx.currentTime

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.6)
    gain.connect(this.master)

    // Sub-bass bed.
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 41

    const drone = ctx.createOscillator()
    drone.type = 'sawtooth'
    drone.frequency.value = 82

    const droneFilter = ctx.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = 240

    // Slow amplitude wobble so the drone breathes.
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.55
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.06
    lfo.connect(lfoGain).connect(gain.gain)

    sub.connect(gain)
    drone.connect(droneFilter).connect(gain)
    sub.start(t)
    drone.start(t)
    lfo.start(t)

    this.alarm = { drone, sub, lfo, gain }

    const klaxon = () => {
      if (!this.ctx || !this.alarm || this.muted) return
      const now = this.ctx.currentTime
      this.tone({ at: now, duration: 0.4, freq: 720, endFreq: 700, gain: 0.2, type: 'square' })
      this.tone({ at: now + 0.45, duration: 0.4, freq: 540, endFreq: 520, gain: 0.2, type: 'square' })
    }
    klaxon()
    this.klaxonTimer = window.setInterval(klaxon, 1400)
  }

  stopAlarm() {
    if (this.klaxonTimer !== null) {
      window.clearInterval(this.klaxonTimer)
      this.klaxonTimer = null
    }
    if (!this.alarm || !this.ctx) {
      this.alarm = null
      return
    }
    const { drone, sub, lfo, gain } = this.alarm
    const t = this.ctx.currentTime
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
    ;[drone, sub, lfo].forEach((osc) => {
      try {
        osc.stop(t + 0.5)
      } catch {
        /* already stopped */
      }
    })
    this.alarm = null
  }

  /**
   * Spoken warning through the Web Speech API when the device provides an
   * offline voice. Purely additive: the on-screen banner is the real channel.
   */
  speak(text: string) {
    if (this.muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 0.95
      utter.pitch = 0.8
      utter.volume = 0.9
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    } catch {
      /* no local voice available — the banner still shows */
    }
  }
}

export const audioEngine = new IndustrialAudioEngine()
export type { Cue }

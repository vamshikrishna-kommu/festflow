/**
 * FestFlow Cinematic 4.0 — Procedural Web Audio Engine
 * Zero external audio files (0 latency, 0 copyright issues).
 * Opt-in generative ambient drone and world transition chimes using the Web Audio API.
 */

type AudioListener = (active: boolean) => void

interface DroneVoice {
  oscSine: OscillatorNode
  oscTri: OscillatorNode
  voiceGain: GainNode
}

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private filterNode: BiquadFilterNode | null = null
  private pannerNode: StereoPannerNode | null = null
  private lfoOsc: OscillatorNode | null = null
  private lfoGain: GainNode | null = null
  private voices: DroneVoice[] = []
  private isAmbienceRunning = false
  private active = false
  private listeners: Set<AudioListener> = new Set()

  // A minor chord notes in Hz (A2, E3, A3, C4)
  private readonly CHORD_FREQS = [110.0, 164.81, 220.0, 261.63]
  private readonly AMBIENCE_TARGET_VOLUME = 0.12

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null
      this.ctx = new AudioCtx()
    }
    return this.ctx
  }

  public isAudioActive(): boolean {
    return this.active
  }

  public addListener(listener: AudioListener): () => void {
    this.listeners.add(listener)
    listener(this.active)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.active)
      } catch (err) {
        console.warn('[AudioEngine] Listener notification failed:', err)
      }
    })
  }

  /**
   * Initializes audio nodes and starts the procedural ambient drone chord.
   */
  public async startAmbience(): Promise<void> {
    const ctx = this.getAudioContext()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch (err) {
        console.warn('[AudioEngine] AudioContext resume failed:', err)
      }
    }

    if (this.isAmbienceRunning && this.masterGain) {
      // Fade back up smoothly if already running
      const now = ctx.currentTime
      this.masterGain.gain.cancelScheduledValues(now)
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
      this.masterGain.gain.linearRampToValueAtTime(this.AMBIENCE_TARGET_VOLUME, now + 1.8)
      this.active = true
      this.notify()
      return
    }

    try {
      const now = ctx.currentTime

      // Master gain node with smooth attack
      const master = ctx.createGain()
      master.gain.setValueAtTime(0.0001, now)
      master.gain.exponentialRampToValueAtTime(this.AMBIENCE_TARGET_VOLUME, now + 2.0)
      this.masterGain = master

      // Gentle lowpass filter at 400Hz to remove harshness and create a warm cosmic wash
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(400, now)
      filter.Q.setValueAtTime(1.1, now)
      this.filterNode = filter

      // Slow LFO for subtle stereo panning drift (0.07Hz)
      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner()
        const lfo = ctx.createOscillator()
        const lfoDepth = ctx.createGain()

        lfo.frequency.setValueAtTime(0.07, now)
        lfoDepth.gain.setValueAtTime(0.45, now) // Pan gently between -0.45 and +0.45
        lfo.connect(lfoDepth)
        lfoDepth.connect(panner.pan)
        lfo.start(now)

        this.lfoOsc = lfo
        this.lfoGain = lfoDepth
        this.pannerNode = panner

        master.connect(filter)
        filter.connect(panner)
        panner.connect(ctx.destination)
      } else {
        master.connect(filter)
        filter.connect(ctx.destination)
      }

      // Generate chord voices: A2, E3, A3, C4
      this.voices = this.CHORD_FREQS.map((freq, idx) => {
        const oscSine = ctx.createOscillator()
        const oscTri = ctx.createOscillator()
        const voiceGain = ctx.createGain()

        oscSine.type = 'sine'
        oscSine.frequency.setValueAtTime(freq, now)

        oscTri.type = 'triangle'
        // Slight detune for analog shimmer
        const detuneCents = (idx % 2 === 0 ? 3.5 : -3.5)
        oscTri.frequency.setValueAtTime(freq, now)
        oscTri.detune.setValueAtTime(detuneCents, now)

        // Lower octaves carry slightly more presence
        const voiceVolume = idx === 0 ? 0.35 : idx === 1 ? 0.28 : 0.22
        voiceGain.gain.setValueAtTime(voiceVolume, now)

        oscSine.connect(voiceGain)
        oscTri.connect(voiceGain)
        voiceGain.connect(master)

        oscSine.start(now)
        oscTri.start(now)

        return { oscSine, oscTri, voiceGain }
      })

      this.isAmbienceRunning = true
      this.active = true
      this.notify()
    } catch (err) {
      console.warn('[AudioEngine] Could not start procedural ambience:', err)
    }
  }

  /**
   * Smoothly fades out and stops the ambient drone.
   */
  public stopAmbience(): void {
    if (!this.ctx || !this.masterGain || !this.isAmbienceRunning) {
      this.active = false
      this.notify()
      return
    }

    try {
      const now = this.ctx.currentTime
      this.masterGain.gain.cancelScheduledValues(now)
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 1.2)

      setTimeout(() => {
        if (!this.active && this.isAmbienceRunning) {
          this.voices.forEach((v) => {
            try {
              v.oscSine.stop()
              v.oscSine.disconnect()
              v.oscTri.stop()
              v.oscTri.disconnect()
              v.voiceGain.disconnect()
            } catch {
              // Ignore stopped node errors
            }
          })
          this.voices = []

          try {
            this.lfoOsc?.stop()
            this.lfoOsc?.disconnect()
            this.lfoGain?.disconnect()
            this.pannerNode?.disconnect()
            this.filterNode?.disconnect()
            this.masterGain?.disconnect()
          } catch {
            // Ignore disconnect errors
          }

          this.isAmbienceRunning = false
        }
      }, 1300)

      this.active = false
      this.notify()
    } catch (err) {
      console.warn('[AudioEngine] Error stopping ambience:', err)
      this.active = false
      this.notify()
    }
  }

  /**
   * Toggles the audio engine state. Returns the new active state.
   */
  public async toggleAudio(): Promise<boolean> {
    if (this.active) {
      this.stopAmbience()
      return false
    } else {
      await this.startAmbience()
      return this.active
    }
  }

  /**
   * Plays a pleasant harmonic bell chime on world transitions or interactive triggers.
   */
  public playChime(freqMultiplier = 1.0): void {
    if (!this.active && !this.isAmbienceRunning) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const baseFreq = 523.25 * freqMultiplier // C5 base bell tone
      const harmonics = [
        { ratio: 1.0, gain: 0.12, decay: 1.6 },
        { ratio: 2.0, gain: 0.08, decay: 1.3 },
        { ratio: 2.76, gain: 0.05, decay: 0.9 }, // Bell inharmonicity
        { ratio: 4.07, gain: 0.03, decay: 0.6 },
      ]

      const chimeBus = ctx.createGain()
      chimeBus.connect(ctx.destination)

      harmonics.forEach(({ ratio, gain, decay }) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(baseFreq * ratio, now)

        g.gain.setValueAtTime(0.0001, now)
        g.gain.exponentialRampToValueAtTime(gain, now + 0.015)
        g.gain.exponentialRampToValueAtTime(0.0001, now + decay)

        osc.connect(g)
        g.connect(chimeBus)

        osc.start(now)
        osc.stop(now + decay + 0.05)
      })
    } catch (err) {
      console.warn('[AudioEngine] Could not play transition chime:', err)
    }
  }
}

// Singleton procedural sound engine
export const soundEngine = new ProceduralSoundEngine()

export function startAmbience(): Promise<void> {
  return soundEngine.startAmbience()
}

export function stopAmbience(): void {
  soundEngine.stopAmbience()
}

export function toggleAudio(): Promise<boolean> {
  return soundEngine.toggleAudio()
}

export function isAudioActive(): boolean {
  return soundEngine.isAudioActive()
}

export function playChime(freqMultiplier = 1.0): void {
  soundEngine.playChime(freqMultiplier)
}

export function addAudioListener(listener: AudioListener): () => void {
  return soundEngine.addListener(listener)
}

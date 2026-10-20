import * as Tone from "tone";
import { midiToFrequency } from "../utils/musicTheory";
import type { AudioStatus } from "../types/music";

/** Anything that can make sound for a MIDI note. A sampler can implement this later. */
export interface Instrument {
  attack(midi: number, velocity: number): void;
  release(midi: number): void;
  releaseAll(): void;
  setReleaseDuration(seconds: number): void;
  dispose(): void;
}

/** Synthesized piano-like voice. Replace with a sample-based Instrument for higher fidelity. */
class SynthPiano implements Instrument {
  private synth: Tone.PolySynth;
  constructor(output: Tone.InputNode) {
    this.synth = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 48 });
    this.synth.set({
      oscillator: {
        type: "custom",
        partials: [1, 0.55, 0.3, 0.16, 0.08, 0.04],
      },
      envelope: { attack: 0.004, decay: 1.4, sustain: 0.12, release: 1.6 },
      volume: -12,
    });
    this.synth.connect(output);
  }
  attack(midi: number, velocity: number) {
    this.synth.triggerAttack(midiToFrequency(midi), Tone.now(), velocity);
  }
  release(midi: number) {
    this.synth.triggerRelease(midiToFrequency(midi), Tone.now());
  }
  releaseAll() {
    this.synth.releaseAll(Tone.now());
  }
  setReleaseDuration(seconds: number) {
    this.synth.set({ envelope: { release: seconds } });
  }
  dispose() {
    this.synth.dispose();
  }
}

/**
 * UI-independent audio engine. Handles lazy init (autoplay policy), polyphony,
 * retriggering, sustain pedal, master volume and clipping protection.
 */
export class AudioEngine {
  status: AudioStatus = "idle";
  error: string | null = null;
  private instrument: Instrument | null = null;
  private master: Tone.Gain | null = null;
  private limiter: Tone.Limiter | null = null;
  private initPromise: Promise<void> | null = null;
  private sounding = new Set<number>(); // notes with an active voice
  private held = new Set<number>(); // notes physically held down
  private sustained = new Set<number>(); // released while pedal down
  private pedal = false;
  private volume = 0.8;
  private releaseDuration = 1.6;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private setStatus(s: AudioStatus, error: string | null = null) {
    this.status = s;
    this.error = error;
    this.listeners.forEach((fn) => fn());
  }

  get ready() {
    return this.status === "ready";
  }

  /** Must be called from a user gesture the first time. Safe to call repeatedly. */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.setStatus("loading");
    this.initPromise = (async () => {
      try {
        Tone.setContext(
          new Tone.Context({ latencyHint: "interactive", lookAhead: 0 }),
        );
        await Tone.start();
        this.limiter = new Tone.Limiter(-3).toDestination();
        this.master = new Tone.Gain(this.volume ** 2).connect(this.limiter);
        const tone = new Tone.Filter({
          type: "lowpass",
          frequency: 6000,
          rolloff: -12,
        }).connect(this.master);
        this.instrument = new SynthPiano(tone);
        this.instrument.setReleaseDuration(this.releaseDuration);
        this.setStatus("ready");
      } catch (e) {
        this.initPromise = null; // allow retry
        this.setStatus(
          "error",
          e instanceof Error ? e.message : "Audio could not be started",
        );
        throw e;
      }
    })();
    return this.initPromise;
  }

  noteOn(midi: number, velocity = 0.8) {
    if (!this.instrument) return;
    this.held.add(midi);
    this.sustained.delete(midi);
    if (this.sounding.has(midi)) this.instrument.release(midi); // clean retrigger of the same pitch
    this.instrument.attack(midi, velocity);
    this.sounding.add(midi);
  }

  noteOff(midi: number) {
    if (!this.instrument) return;
    this.held.delete(midi);
    if (this.pedal) {
      this.sustained.add(midi);
      return;
    }
    this.stopVoice(midi);
  }

  setSustain(down: boolean) {
    this.pedal = down;
    if (!down) {
      for (const m of this.sustained) if (!this.held.has(m)) this.stopVoice(m);
      this.sustained.clear();
    }
  }

  releaseAll() {
    this.instrument?.releaseAll();
    this.sounding.clear();
    this.held.clear();
    this.sustained.clear();
  }

  /** Set the soft note-release tail in seconds. Longer values let notes ring out gently. */
  setReleaseDuration(seconds: number) {
    this.releaseDuration = Math.min(4, Math.max(0.2, seconds));
    this.instrument?.setReleaseDuration(this.releaseDuration);
  }

  /** v in [0, 1]; perceptual (squared) curve. */
  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    this.master?.gain.rampTo(this.volume ** 2, 0.03);
  }

  private stopVoice(midi: number) {
    if (this.sounding.delete(midi)) this.instrument?.release(midi);
  }

  dispose() {
    this.releaseAll();
    this.instrument?.dispose();
    this.master?.dispose();
    this.limiter?.dispose();
    this.instrument = this.master = this.limiter = null;
    this.initPromise = null;
    this.setStatus("idle");
  }
}

export const audioEngine = new AudioEngine();

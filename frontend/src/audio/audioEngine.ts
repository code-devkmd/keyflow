import * as Tone from "tone";
import { midiToFrequency } from "@/shared/utils/musicTheory";
import type { AudioStatus } from "@/shared/types/music";

export type InstrumentMode = "synth" | "sampled";

/** Common interface for instruments hosted by the audio engine. */
export interface Instrument {
  attack(midiNote: number, velocity: number): void;
  release(midiNote: number): void;
  releaseAll(): void;
  setReleaseDuration(seconds: number): void;
  dispose(): void;
}

/** Lightweight synthesized piano-like voice. Always available offline. */
class SynthPiano implements Instrument {
  private readonly synth: Tone.PolySynth;

  constructor(output: Tone.InputNode, releaseDuration: number) {
    this.synth = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 48 });
    this.synth.set({
      oscillator: {
        type: "custom",
        partials: [1, 0.55, 0.3, 0.16, 0.08, 0.04],
      },
      envelope: {
        attack: 0.004,
        decay: 1.4,
        sustain: 0.12,
        release: releaseDuration,
      },
      volume: -12,
    });
    this.synth.connect(output);
  }

  attack(midiNote: number, velocity: number): void {
    this.synth.triggerAttack(midiToFrequency(midiNote), Tone.now(), velocity);
  }

  release(midiNote: number): void {
    this.synth.triggerRelease(midiToFrequency(midiNote), Tone.now());
  }

  releaseAll(): void {
    this.synth.releaseAll(Tone.now());
  }

  setReleaseDuration(seconds: number): void {
    this.synth.set({ envelope: { release: seconds } });
  }

  dispose(): void {
    this.synth.dispose();
  }
}

/**
 * Sampled piano using the Salamander piano samples hosted by Tone.js.
 * The samples are downloaded only when this instrument is selected.
 */
class SampledPiano implements Instrument {
  private readonly sampler: Tone.Sampler;
  private readonly activeNotes = new Set<number>();

  private constructor(
    output: Tone.InputNode,
    releaseDuration: number,
    onLoad: () => void,
  ) {
    this.sampler = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        A6: "A6.mp3",
        C7: "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        C8: "C8.mp3",
      },
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      release: releaseDuration,
      onload: onLoad,
    });
    this.sampler.connect(output);
  }

  static load(
    output: Tone.InputNode,
    releaseDuration: number,
  ): Promise<SampledPiano> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let instrument: SampledPiano | null = null;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        instrument?.dispose();
        reject(
          new Error(
            "Piano samples took too long to load. Check your internet connection.",
          ),
        );
      }, 20_000);

      instrument = new SampledPiano(output, releaseDuration, () => {
        if (settled || !instrument) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(instrument);
      });
    });
  }

  attack(midiNote: number, velocity: number): void {
    this.activeNotes.add(midiNote);
    this.sampler.triggerAttack(midiToFrequency(midiNote), Tone.now(), velocity);
  }

  release(midiNote: number): void {
    this.activeNotes.delete(midiNote);
    this.sampler.triggerRelease(midiToFrequency(midiNote), Tone.now());
  }

  releaseAll(): void {
    for (const midiNote of this.activeNotes) {
      this.sampler.triggerRelease(midiToFrequency(midiNote), Tone.now());
    }
    this.activeNotes.clear();
  }

  setReleaseDuration(seconds: number): void {
    this.sampler.release = seconds;
  }

  dispose(): void {
    this.releaseAll();
    this.sampler.dispose();
  }
}

/**
 * UI-independent audio engine. Owns the audio graph, polyphony, sustain and instruments.
 * The Web Audio context is started lazily in response to a user gesture.
 */
export class AudioEngine {
  status: AudioStatus = "idle";
  error: string | null = null;

  private instrument: Instrument | null = null;
  private instrumentMode: InstrumentMode = "synth";
  private master: Tone.Gain | null = null;
  private limiter: Tone.Limiter | null = null;
  private reverb: Tone.Reverb | null = null;
  private filter: Tone.Filter | null = null;
  private initPromise: Promise<void> | null = null;
  private soundingNotes = new Set<number>();
  private heldNotes = new Set<number>();
  private sustainedNotes = new Set<number>();
  private sustainPedalDown = false;
  private volume = 0.8;
  private reverbAmount = 0.18;
  private releaseDuration = 1.6;
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publishStatus(
    status: AudioStatus,
    error: string | null = null,
  ): void {
    this.status = status;
    this.error = error;
    this.listeners.forEach((listener) => listener());
  }

  get ready(): boolean {
    return this.status === "ready";
  }

  get currentInstrumentMode(): InstrumentMode {
    return this.instrumentMode;
  }

  /** Must be called from a user gesture the first time. Safe to call repeatedly. */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.publishStatus("loading");
    this.initPromise = (async () => {
      try {
        Tone.setContext(
          new Tone.Context({ latencyHint: "interactive", lookAhead: 0 }),
        );
        await Tone.start();

        this.limiter = new Tone.Limiter(-3).toDestination();
        this.master = new Tone.Gain(this.volume ** 2).connect(this.limiter);
        this.reverb = new Tone.Reverb({
          decay: 2.2,
          wet: this.reverbAmount,
        }).connect(this.master);
        this.filter = new Tone.Filter({
          type: "lowpass",
          frequency: 6000,
          rolloff: -12,
        });
        this.filter.connect(this.reverb);
        this.instrument = new SynthPiano(this.filter, this.releaseDuration);
        this.instrumentMode = "synth";
        this.publishStatus("ready");
      } catch (error) {
        this.initPromise = null;
        this.publishStatus(
          "error",
          error instanceof Error ? error.message : "Audio could not be started",
        );
        throw error;
      }
    })();

    return this.initPromise;
  }

  async setInstrumentMode(mode: InstrumentMode): Promise<void> {
    if (mode === this.instrumentMode && this.instrument) return;
    await this.init();
    if (mode === this.instrumentMode && this.instrument) return;

    const output = this.filter;
    if (!output) throw new Error("Audio output is not available yet.");

    if (mode === "sampled") {
      this.publishStatus("loading");
      try {
        const sampledInstrument = await SampledPiano.load(
          output,
          this.releaseDuration,
        );
        this.instrument?.releaseAll();
        this.instrument?.dispose();
        this.instrument = sampledInstrument;
        this.instrumentMode = "sampled";
        this.publishStatus("ready");
      } catch (error) {
        this.publishStatus("ready");
        throw error;
      }
      return;
    }

    this.instrument?.releaseAll();
    this.instrument?.dispose();
    this.instrument = new SynthPiano(output, this.releaseDuration);
    this.instrumentMode = "synth";
    this.publishStatus("ready");
  }

  noteOn(midiNote: number, velocity = 0.8): void {
    if (!this.instrument) return;
    this.heldNotes.add(midiNote);
    this.sustainedNotes.delete(midiNote);

    if (this.soundingNotes.has(midiNote)) this.instrument.release(midiNote);
    this.instrument.attack(midiNote, velocity);
    this.soundingNotes.add(midiNote);
  }

  noteOff(midiNote: number): void {
    if (!this.instrument) return;
    this.heldNotes.delete(midiNote);

    if (this.sustainPedalDown) {
      this.sustainedNotes.add(midiNote);
      return;
    }

    this.stopVoice(midiNote);
  }

  setSustain(isDown: boolean): void {
    this.sustainPedalDown = isDown;
    if (isDown) return;

    for (const midiNote of this.sustainedNotes) {
      if (!this.heldNotes.has(midiNote)) this.stopVoice(midiNote);
    }
    this.sustainedNotes.clear();
  }

  releaseAll(): void {
    this.instrument?.releaseAll();
    this.soundingNotes.clear();
    this.heldNotes.clear();
    this.sustainedNotes.clear();
  }

  setReleaseDuration(seconds: number): void {
    this.releaseDuration = Math.min(4, Math.max(0.2, seconds));
    this.instrument?.setReleaseDuration(this.releaseDuration);
  }

  setReverbAmount(value: number): void {
    this.reverbAmount = Math.min(0.6, Math.max(0, value));
    this.reverb?.wet.rampTo(this.reverbAmount, 0.08);
  }

  /** Perceptual volume curve prevents the useful range from being crowded near silence. */
  setVolume(value: number): void {
    this.volume = Math.min(1, Math.max(0, value));
    this.master?.gain.rampTo(this.volume ** 2, 0.03);
  }

  private stopVoice(midiNote: number): void {
    if (this.soundingNotes.delete(midiNote)) this.instrument?.release(midiNote);
  }

  dispose(): void {
    this.releaseAll();
    this.instrument?.dispose();
    this.filter?.dispose();
    this.reverb?.dispose();
    this.master?.dispose();
    this.limiter?.dispose();
    this.instrument = null;
    this.filter = null;
    this.reverb = null;
    this.master = null;
    this.limiter = null;
    this.initPromise = null;
    this.instrumentMode = "synth";
    this.publishStatus("idle");
  }
}

export const audioEngine = new AudioEngine();

/** MIDI note number is the single source of truth for pitch (60 = C4, A4 = 69 = 440 Hz). */
export interface NoteEvent {
  midi: number;
  noteName: string;
  startTime: number; // seconds
  duration: number; // seconds
  velocity: number; // 0-127
  track: number;
}

export type AudioStatus = "idle" | "loading" | "ready" | "error";

/** Maps KeyboardEvent.code (physical key position, layout independent) to an absolute MIDI note (60 = C4). */
export type KeyMapping = Readonly<Record<string, number>>;

// Display convention used everywhere in the app: scientific pitch notation, MIDI 60 = C4.
const NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d+)$/;
const NATURAL_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export const MIDI_MIN = 0;
export const MIDI_MAX = 127;

export function isValidMidi(midi: number): boolean {
  return Number.isInteger(midi) && midi >= MIDI_MIN && midi <= MIDI_MAX;
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function getOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function isBlackKey(midi: number): boolean {
  return BLACK_PCS.has(pitchClass(midi));
}

export function midiToNoteName(midi: number): string {
  if (!isValidMidi(midi)) throw new RangeError(`Invalid MIDI note: ${midi}`);
  return `${NAMES[pitchClass(midi)]}${getOctave(midi)}`;
}

/** Accepts "C4", "c#4", "Db3", "A-1". Throws on invalid input. */
export function noteNameToMidi(name: string): number {
  const m = NOTE_RE.exec(name.trim());
  if (!m) throw new Error(`Invalid note name: ${name}`);
  const letter = m[1].toUpperCase();
  const accidental = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  const midi = (parseInt(m[3], 10) + 1) * 12 + NATURAL_PC[letter] + accidental;
  if (!isValidMidi(midi))
    throw new RangeError(`Note out of MIDI range: ${name}`);
  return midi;
}

/** Equal temperament. */
export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Formats seconds as m:ss (or m:ss.t when fractional is true). */
export function formatDuration(seconds: number, fractional = false): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  if (fractional) return `${m}:${rest.toFixed(1).padStart(4, "0")}`;
  return `${m}:${Math.floor(rest).toString().padStart(2, "0")}`;
}

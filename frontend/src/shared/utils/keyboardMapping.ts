import type { KeyMapping } from "@/shared/types/music";
import { noteNameToMidi } from "@/shared/utils/musicTheory";

/**
 * Two-octave chromatic QWERTY layout, based on physical key positions.
 * Lower octave C3-B3: Z X C V B N M (white), S D G H J (black).
 * Upper octave C4-C5: Q W E R T Y U I (white), 2 3 5 6 7 (black).
 * Arrow keys transpose this entire layout in octave steps, so the whole piano range is reachable.
 */
const TWO_OCTAVE_LAYOUT: Array<[code: string, note: string]> = [
  // Lower octave: C3 to B3
  ["KeyZ", "C3"],
  ["KeyS", "C#3"],
  ["KeyX", "D3"],
  ["KeyD", "D#3"],
  ["KeyC", "E3"],
  ["KeyV", "F3"],
  ["KeyG", "F#3"],
  ["KeyB", "G3"],
  ["KeyH", "G#3"],
  ["KeyN", "A3"],
  ["KeyJ", "A#3"],
  ["KeyM", "B3"],
  // Upper octave: C4 to C5
  ["KeyQ", "C4"],
  ["Digit2", "C#4"],
  ["KeyW", "D4"],
  ["Digit3", "D#4"],
  ["KeyE", "E4"],
  ["KeyR", "F4"],
  ["Digit5", "F#4"],
  ["KeyT", "G4"],
  ["Digit6", "G#4"],
  ["KeyY", "A4"],
  ["Digit7", "A#4"],
  ["KeyU", "B4"],
  ["KeyI", "C5"],
];

/** Build a mapping from physical KeyboardEvent.code values to absolute MIDI note numbers. */
export function buildMapping(
  pairs: ReadonlyArray<readonly [string, string]>,
): KeyMapping {
  const out: Record<string, number> = {};
  for (const [code, note] of pairs) {
    if (code in out) throw new Error(`Duplicate key in mapping: ${code}`);
    out[code] = noteNameToMidi(note);
  }
  return out;
}

export const DEFAULT_MAPPING: KeyMapping = buildMapping(TWO_OCTAVE_LAYOUT);

/** Resolve a physical key to a MIDI note, applying a transpose in semitones. */
export function codeToMidi(
  code: string,
  transpose = 0,
  mapping: KeyMapping = DEFAULT_MAPPING,
): number | null {
  const base = mapping[code];
  if (base === undefined) return null;
  const midi = base + transpose;
  return midi >= 0 && midi <= 127 ? midi : null;
}

/** Reverse lookup (MIDI -> key label) used to print shortcuts on the piano keys. */
export function midiToLabels(
  transpose = 0,
  mapping: KeyMapping = DEFAULT_MAPPING,
  layoutMap?: ReadonlyMap<string, string> | null,
): Map<number, string> {
  const out = new Map<number, string>();
  for (const code of Object.keys(mapping)) {
    const midi = codeToMidi(code, transpose, mapping);
    if (midi !== null && !out.has(midi))
      out.set(midi, codeLabel(code, layoutMap));
  }
  return out;
}

const SPECIAL: Record<string, string> = {
  Comma: ",",
  Period: ".",
  Semicolon: ";",
  Slash: "/",
  Quote: "'",
};

/** Printable label for a physical key; prefers the user's real layout when the browser exposes it. */
export function codeLabel(
  code: string,
  layoutMap?: ReadonlyMap<string, string> | null,
): string {
  const real = layoutMap?.get(code);
  if (real) return real.toUpperCase();
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return SPECIAL[code] ?? code;
}

/** Chromium exposes the real layout via navigator.keyboard; elsewhere use standard QWERTY labels. */
export async function loadLayoutMap(): Promise<ReadonlyMap<
  string,
  string
> | null> {
  try {
    const kb = (
      navigator as unknown as {
        keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> };
      }
    ).keyboard;
    return (await kb?.getLayoutMap?.()) ?? null;
  } catch {
    return null;
  }
}

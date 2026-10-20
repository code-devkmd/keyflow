import { Midi } from "@tonejs/midi";
import type { NoteEvent } from "@/shared/types/music";
import { midiToNoteName } from "@/shared/utils/musicTheory";
import { sortNotes } from "@/shared/utils/chordUtils";

export const MAX_MIDI_BYTES = 2 * 1024 * 1024;
export const MAX_MIDI_NOTES = 20000;

export interface ParsedTrack {
  index: number;
  name: string;
  noteCount: number;
}
export interface ParsedSong {
  title: string;
  /** Tempo at the start of the file, rounded; later tempo changes are already baked into note times. */
  bpm: number;
  duration: number;
  notes: NoteEvent[]; // sorted, seconds
  tracks: ParsedTrack[];
}

export class MidiImportError extends Error {}

/** Cheap checks done before reading the file contents. */
export function validateMidiFile(file: { name: string; size: number }): void {
  if (!/\.(mid|midi)$/i.test(file.name))
    throw new MidiImportError("Please choose a MIDI file (.mid or .midi).");
  if (file.size === 0) throw new MidiImportError("This file is empty.");
  if (file.size > MAX_MIDI_BYTES)
    throw new MidiImportError(
      "This file is larger than 2 MB, which is too big for a MIDI song.",
    );
}

/** Parses a Standard MIDI File. Real note events only; percussion tracks are skipped. */
export function parseMidi(
  buffer: ArrayBuffer,
  fallbackTitle = "Imported song",
): ParsedSong {
  const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  if (String.fromCharCode(...head) !== "MThd")
    throw new MidiImportError("This does not look like a valid MIDI file.");
  let midi: Midi;
  try {
    midi = new Midi(buffer);
  } catch {
    throw new MidiImportError(
      "This MIDI file could not be read. It may be damaged.",
    );
  }
  const notes: NoteEvent[] = [];
  const tracks: ParsedTrack[] = [];
  midi.tracks.forEach((t, index) => {
    if (t.instrument.percussion || t.notes.length === 0) return;
    tracks.push({
      index,
      name: t.name?.trim() || `Track ${index + 1}`,
      noteCount: t.notes.length,
    });
    for (const n of t.notes) {
      notes.push({
        midi: n.midi,
        noteName: midiToNoteName(n.midi),
        startTime: n.time,
        duration: n.duration,
        velocity: Math.round(n.velocity * 127),
        track: index,
      });
    }
  });
  if (notes.length === 0)
    throw new MidiImportError(
      "No playable notes were found in this MIDI file.",
    );
  if (notes.length > MAX_MIDI_NOTES)
    throw new MidiImportError(
      `This song has ${notes.length} notes; the limit is ${MAX_MIDI_NOTES}.`,
    );
  const sorted = sortNotes(notes);
  const last = sorted.reduce(
    (m, n) => Math.max(m, n.startTime + n.duration),
    0,
  );
  return {
    title: midi.name?.trim() || fallbackTitle,
    bpm: Math.round(midi.header.tempos[0]?.bpm ?? 120),
    duration: last,
    notes: sorted,
    tracks,
  };
}

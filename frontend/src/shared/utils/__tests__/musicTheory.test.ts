import { describe, expect, it } from "vitest";
import {
  formatDuration,
  getOctave,
  isBlackKey,
  midiToFrequency,
  midiToNoteName,
  noteNameToMidi,
} from "@/shared/utils/musicTheory";
import { groupChords, sortNotes } from "@/shared/utils/chordUtils";
import type { NoteEvent } from "@/shared/types/music";

const n = (midi: number, startTime: number, track = 0): NoteEvent => ({
  midi,
  noteName: midiToNoteName(midi),
  startTime,
  duration: 0.5,
  velocity: 90,
  track,
});

describe("note names", () => {
  it("converts MIDI to names (60 = C4)", () => {
    expect(midiToNoteName(60)).toBe("C4");
    expect(midiToNoteName(61)).toBe("C#4");
    expect(midiToNoteName(62)).toBe("D4");
    expect(midiToNoteName(69)).toBe("A4");
    expect(midiToNoteName(0)).toBe("C-1");
    expect(midiToNoteName(127)).toBe("G9");
  });
  it("round-trips every MIDI note", () => {
    for (let m = 0; m <= 127; m++)
      expect(noteNameToMidi(midiToNoteName(m))).toBe(m);
  });
  it("parses flats and lowercase", () => {
    expect(noteNameToMidi("Db4")).toBe(61);
    expect(noteNameToMidi("c#4")).toBe(61);
  });
  it("rejects invalid input", () => {
    expect(() => noteNameToMidi("H4")).toThrow();
    expect(() => midiToNoteName(128)).toThrow();
    expect(() => midiToNoteName(1.5)).toThrow();
  });
  it("identifies octave and black keys", () => {
    expect(getOctave(59)).toBe(3);
    expect(getOctave(60)).toBe(4);
    expect(isBlackKey(61)).toBe(true);
    expect(isBlackKey(62)).toBe(false);
  });
});

describe("frequency", () => {
  it("A4 = 440 Hz, C4 ≈ 261.63 Hz, octave doubles", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3);
    expect(midiToFrequency(81)).toBeCloseTo(880, 6);
  });
  it("respects custom tuning", () => {
    expect(midiToFrequency(69, 432)).toBeCloseTo(432, 6);
  });
});

describe("formatDuration", () => {
  it("formats m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65.9)).toBe("1:05");
    expect(formatDuration(-3)).toBe("0:00");
  });
});

describe("sorting and chord grouping", () => {
  it("sorts by start, then pitch", () => {
    const sorted = sortNotes([n(64, 1), n(60, 0.5), n(62, 0.5)]);
    expect(sorted.map((x) => x.midi)).toEqual([60, 62, 64]);
  });
  it("does not mutate input", () => {
    const input = [n(64, 1), n(60, 0)];
    sortNotes(input);
    expect(input[0].midi).toBe(64);
  });
  it("groups near-simultaneous notes as chords", () => {
    const groups = groupChords(
      [n(67, 0.01), n(60, 0), n(64, 0.02), n(72, 1)],
      0.03,
    );
    expect(groups.map((g) => g.map((x) => x.midi))).toEqual([
      [60, 64, 67],
      [72],
    ]);
  });
  it("keeps notes apart beyond tolerance and handles empty input", () => {
    expect(groupChords([n(60, 0), n(62, 0.5)])).toHaveLength(2);
    expect(groupChords([])).toEqual([]);
  });
});

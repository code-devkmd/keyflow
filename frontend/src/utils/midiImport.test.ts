import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { MidiImportError, parseMidi, validateMidiFile } from "./midiImport";
import { currentStepIndex, matchStep, songToSteps } from "./practiceSteps";

function makeMidi(build: (m: Midi) => void): ArrayBuffer {
  const m = new Midi();
  m.header.setTempo(120);
  build(m);
  const a = m.toArray();
  return a.buffer.slice(
    a.byteOffset,
    a.byteOffset + a.byteLength,
  ) as ArrayBuffer;
}

describe("parseMidi", () => {
  it("reads pitch, timing, velocity and tracks, sorted, with chords and overlaps preserved", () => {
    const song = parseMidi(
      makeMidi((m) => {
        const a = m.addTrack();
        a.name = "Right";
        a.addNote({ midi: 64, time: 0.5, duration: 0.5, velocity: 0.5 });
        a.addNote({ midi: 60, time: 0, duration: 1, velocity: 1 }); // overlaps the E
        const b = m.addTrack();
        b.addNote({ midi: 48, time: 0, duration: 2 });
      }),
    );
    expect(song.bpm).toBe(120);
    expect(
      song.notes.map((n) => [n.midi, n.noteName, n.startTime, n.track]),
    ).toEqual([
      [48, "C3", 0, 1],
      [60, "C4", 0, 0],
      [64, "E4", 0.5, 0],
    ]);
    expect(song.notes[1].velocity).toBe(127);
    expect(song.notes[2].duration).toBeCloseTo(0.5, 2);
    expect(song.tracks.map((t) => [t.index, t.noteCount])).toEqual([
      [0, 2],
      [1, 1],
    ]);
    expect(song.duration).toBeCloseTo(2, 2);
  });
  it("applies tempo to note times (60 bpm: 1 beat = 1 s)", () => {
    const song = parseMidi(
      makeMidi((m) => {
        m.header.setTempo(60);
        m.addTrack().addNote({
          midi: 60,
          ticks: m.header.ppq,
          durationTicks: 10,
        });
      }),
    );
    expect(song.notes[0].startTime).toBeCloseTo(1, 2);
  });
  it("rejects empty MIDI, non-MIDI bytes and truncated files", () => {
    expect(() =>
      parseMidi(
        makeMidi((m) => {
          m.addTrack();
        }),
      ),
    ).toThrow(/No playable notes/);
    expect(() =>
      parseMidi(new TextEncoder().encode("hello world").buffer as ArrayBuffer),
    ).toThrow(MidiImportError);
    const ok = makeMidi((m) =>
      m.addTrack().addNote({ midi: 60, time: 0, duration: 1 }),
    );
    expect(() => parseMidi(ok.slice(0, 10))).toThrow(MidiImportError);
  });
  it("validates name and size before reading", () => {
    expect(() => validateMidiFile({ name: "a.mp3", size: 10 })).toThrow(
      /MIDI file/,
    );
    expect(() => validateMidiFile({ name: "a.mid", size: 0 })).toThrow(/empty/);
    expect(() =>
      validateMidiFile({ name: "a.mid", size: 3 * 1024 * 1024 }),
    ).toThrow(/2 MB/);
    expect(() => validateMidiFile({ name: "A.MIDI", size: 100 })).not.toThrow();
  });
});

describe("practice steps", () => {
  const notes = parseMidi(
    makeMidi((m) => {
      const t = m.addTrack();
      t.addNote({ midi: 60, time: 0, duration: 0.5 });
      t.addNote({ midi: 64, time: 0.01, duration: 0.5 }); // chord
      t.addNote({ midi: 67, time: 1, duration: 0.5 });
    }),
  ).notes;
  it("groups chords and converts seconds to beats at the song tempo", () => {
    const steps = songToSteps(notes, 120);
    expect(steps.map((s) => [s.notes, s.at])).toEqual([
      [[60, 64], 0],
      [[67], 2],
    ]);
    expect(steps[0].label).toBe("C4 + E4");
  });
  it("transposes by octaves and drops notes outside MIDI range", () => {
    expect(songToSteps(notes, 120, -1)[0].notes).toEqual([48, 52]);
    expect(songToSteps(notes, 120, 9)).toEqual([]);
  });
  it("finds the current step", () => {
    const steps = songToSteps(notes, 120);
    expect([
      currentStepIndex(steps, 0),
      currentStepIndex(steps, 1.9),
      currentStepIndex(steps, 2),
    ]).toEqual([0, 0, 1]);
  });
  it("matches correct notes in time, once, and rejects wrong or early/late ones", () => {
    const steps = songToSteps(notes, 120);
    const used = new Set<string>();
    expect(matchStep(steps, 0.1, 64, used)).toBe(0);
    expect(matchStep(steps, 2.2, 67, used)).toBe(1);
    expect(matchStep(steps, 1.0, 67, used)).toBe(-1); // too early
    expect(matchStep(steps, 0.1, 62, used)).toBe(-1); // wrong note
    used.add("0:64");
    expect(matchStep(steps, 0.1, 64, used)).toBe(-1); // already hit
  });
});

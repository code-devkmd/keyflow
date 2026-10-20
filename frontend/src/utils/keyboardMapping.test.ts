import { describe, expect, it } from "vitest";
import {
  buildMapping,
  codeLabel,
  codeToMidi,
  DEFAULT_MAPPING,
  midiToLabels,
} from "./keyboardMapping";
import { midiToNoteName } from "./musicTheory";

const SPEC: Record<string, string> = {
  KeyZ: "C3",
  KeyS: "C#3",
  KeyX: "D3",
  KeyD: "D#3",
  KeyC: "E3",
  KeyV: "F3",
  KeyG: "F#3",
  KeyB: "G3",
  KeyH: "G#3",
  KeyN: "A3",
  KeyJ: "A#3",
  KeyM: "B3",
  KeyQ: "C4",
  Digit2: "C#4",
  KeyW: "D4",
  Digit3: "D#4",
  KeyE: "E4",
  KeyR: "F4",
  Digit5: "F#4",
  KeyT: "G4",
  Digit6: "G#4",
  KeyY: "A4",
  Digit7: "A#4",
  KeyU: "B4",
  KeyI: "C5",
};

describe("default two-octave chromatic keyboard mapping", () => {
  it.each(Object.entries(SPEC))("%s plays %s", (code, note) => {
    expect(midiToNoteName(codeToMidi(code)!)).toBe(note);
  });
  it("maps every white and black key in two octaves", () => {
    expect(Object.keys(DEFAULT_MAPPING)).toHaveLength(25);
    for (const code of Object.keys(SPEC))
      expect(DEFAULT_MAPPING).toHaveProperty(code);
  });
  it("transposes by octaves and supports the full piano range", () => {
    expect(codeToMidi("KeyZ", -36)).toBe(12); // C0
    expect(codeToMidi("KeyI", 36)).toBe(108); // C8
    expect(codeToMidi("KeyQ", 12)).toBe(72); // C5
  });
  it("returns null for unmapped keys and out-of-range results", () => {
    expect(codeToMidi("KeyA")).toBeNull();
    expect(codeToMidi("KeyI", 100)).toBeNull();
  });
  it("labels update with octave shifts", () => {
    expect(midiToLabels(0).get(48)).toBe("Z");
    expect(midiToLabels(0).get(60)).toBe("Q");
    expect(midiToLabels(0).get(61)).toBe("2");
    expect(midiToLabels(12).get(72)).toBe("Q");
  });
  it("prefers the real layout map for labels (e.g. AZERTY)", () => {
    expect(codeLabel("KeyA", new Map([["KeyA", "q"]]))).toBe("Q");
  });
  it("supports custom mappings and rejects duplicate keys", () => {
    expect(codeToMidi("KeyZ", 0, buildMapping([["KeyZ", "C3"]]))).toBe(48);
    expect(() =>
      buildMapping([
        ["KeyZ", "C3"],
        ["KeyZ", "D3"],
      ]),
    ).toThrow();
  });
});

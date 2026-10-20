import { beforeEach, describe, expect, it } from "vitest";
import {
  KeyboardController,
  type KeyEventLike,
  type KeyboardOptions,
} from "./keyboardController";

let log: string[];
let opts: KeyboardOptions;
let c: KeyboardController;
let prevented: number;

const ev = (code: string, extra: Partial<KeyEventLike> = {}): KeyEventLike => ({
  code,
  preventDefault: () => {
    prevented++;
  },
  ...extra,
});

beforeEach(() => {
  log = [];
  prevented = 0;
  opts = {
    transpose: 0,
    onNoteOn: (m, s) => log.push(`on ${m} ${s}`),
    onNoteOff: (m, s) => log.push(`off ${m} ${s}`),
    onPedal: (d) => log.push(`pedal ${d}`),
    onReleaseAll: () => log.push("releaseAll"),
  };
  c = new KeyboardController(() => opts);
});

describe("KeyboardController", () => {
  it("starts and releases the right note", () => {
    c.keyDown(ev("KeyQ"));
    c.keyUp(ev("KeyQ"));
    expect(log).toEqual(["on 60 kbd:KeyQ", "off 60 kbd:KeyQ"]);
  });
  it("ignores auto-repeat while held", () => {
    c.keyDown(ev("KeyQ"));
    c.keyDown(ev("KeyQ", { repeat: true }));
    c.keyDown(ev("KeyQ"));
    expect(log).toEqual(["on 60 kbd:KeyQ"]);
  });
  it("plays chords and releases in any order", () => {
    c.keyDown(ev("KeyQ"));
    c.keyDown(ev("KeyE"));
    c.keyDown(ev("KeyT"));
    c.keyUp(ev("KeyE"));
    c.keyUp(ev("KeyT"));
    c.keyUp(ev("KeyQ"));
    expect(log).toEqual([
      "on 60 kbd:KeyQ",
      "on 64 kbd:KeyE",
      "on 67 kbd:KeyT",
      "off 64 kbd:KeyE",
      "off 67 kbd:KeyT",
      "off 60 kbd:KeyQ",
    ]);
  });
  it("plays all notes assigned to a custom shortcut and releases them together", () => {
    opts = { ...opts, chordShortcuts: [{ code: "KeyA", notes: [41, 48, 53] }] };
    c = new KeyboardController(() => opts);
    c.keyDown(ev("KeyA"));
    c.keyUp(ev("KeyA"));
    expect(log).toEqual([
      "on 41 kbd:KeyA",
      "on 48 kbd:KeyA",
      "on 53 kbd:KeyA",
      "off 41 kbd:KeyA",
      "off 48 kbd:KeyA",
      "off 53 kbd:KeyA",
    ]);
  });
  it("custom shortcuts take priority and transpose all assigned notes", () => {
    opts = {
      ...opts,
      transpose: 12,
      chordShortcuts: [{ code: "KeyQ", notes: [48, 55] }],
    };
    c = new KeyboardController(() => opts);
    c.keyDown(ev("KeyQ"));
    c.keyUp(ev("KeyQ"));
    expect(log).toEqual([
      "on 60 kbd:KeyQ",
      "on 67 kbd:KeyQ",
      "off 60 kbd:KeyQ",
      "off 67 kbd:KeyQ",
    ]);
  });
  it("releases the original note if transpose changes mid-hold", () => {
    c.keyDown(ev("KeyQ"));
    opts = { ...opts, transpose: 12 };
    c.keyUp(ev("KeyQ"));
    expect(log).toEqual(["on 60 kbd:KeyQ", "off 60 kbd:KeyQ"]);
  });
  it("releaseAll (blur / tab hidden) releases every held key and the pedal, once", () => {
    c.keyDown(ev("KeyQ"));
    c.keyDown(ev("KeyW"));
    c.keyDown(ev("Space"));
    log.length = 0;
    c.releaseAll();
    c.releaseAll();
    expect(log).toEqual(["off 60 kbd:KeyQ", "off 62 kbd:KeyW", "pedal false"]);
    expect(c.heldCodes).toEqual([]);
  });
  it("can replay a key after releaseAll even if keyup never arrived", () => {
    c.keyDown(ev("KeyQ"));
    c.releaseAll();
    log.length = 0;
    c.keyDown(ev("KeyQ"));
    expect(log).toEqual(["on 60 kbd:KeyQ"]);
  });
  it("Escape releases everything and is not prevented", () => {
    c.keyDown(ev("KeyQ"));
    log.length = 0;
    prevented = 0;
    c.keyDown(ev("Escape"));
    expect(log).toEqual(["off 60 kbd:KeyQ", "releaseAll"]);
    expect(prevented).toBe(0);
  });
  it("does not touch typing targets or shortcuts", () => {
    c.keyDown(ev("KeyQ", { target: { tagName: "INPUT" } }));
    c.keyDown(
      ev("KeyQ", { target: { tagName: "DIV", isContentEditable: true } }),
    );
    c.keyDown(ev("KeyQ", { ctrlKey: true }));
    expect(log).toEqual([]);
    expect(prevented).toBe(0);
  });
  it("only prevents default for handled keys", () => {
    c.keyDown(ev("KeyA"));
    c.keyDown(ev("Tab"));
    expect(prevented).toBe(0);
    c.keyDown(ev("KeyQ"));
    expect(prevented).toBe(1);
  });
  it("does nothing when disabled", () => {
    opts = { ...opts, enabled: false };
    c.keyDown(ev("KeyA"));
    expect(log).toEqual([]);
  });
  it("sustain pedal engages once per press", () => {
    c.keyDown(ev("Space"));
    c.keyDown(ev("Space", { repeat: true }));
    c.keyUp(ev("Space"));
    expect(log).toEqual(["pedal true", "pedal false"]);
  });
});

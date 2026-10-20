import type { KeyMapping } from "@/shared/types/music";
import { codeToMidi, DEFAULT_MAPPING } from "@/shared/utils/keyboardMapping";

export interface KeyboardOptions {
  enabled?: boolean;
  /** Semitones added to every mapped note (octave shift = 12). */
  transpose: number;
  mapping?: KeyMapping;
  /** Optional one-key chord shortcuts; custom entries take precedence over the normal layout. */
  chordShortcuts?: ReadonlyArray<{ code: string; notes: readonly number[] }>;
  onNoteOn: (midi: number, source: string) => void;
  onNoteOff: (midi: number, source: string) => void;
  onPedal?: (down: boolean, source?: string) => void;
  onOctaveShift?: (delta: number) => void;
  /** Called on Escape so the app can also drop pointer-held notes. */
  onReleaseAll?: () => void;
}

/** The subset of KeyboardEvent we use, so the controller is testable without a DOM. */
export interface KeyEventLike {
  code: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: unknown;
  preventDefault(): void;
}

export function isTypingTarget(t: unknown): boolean {
  const el = t as { tagName?: string; isContentEditable?: boolean } | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    !!el.isContentEditable
  );
}

/**
 * Framework-free input state machine. Tracks which physical keys are down and the MIDI note each
 * one started (captured at press time, so a transpose change mid-hold still releases the right note).
 */
export class KeyboardController {
  private down = new Map<string, number[]>();
  private pedal = false;

  constructor(private getOptions: () => KeyboardOptions) {}

  get heldCodes(): string[] {
    return [...this.down.keys()];
  }

  keyDown(e: KeyEventLike): void {
    const o = this.getOptions();
    if (
      o.enabled === false ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      isTypingTarget(e.target)
    )
      return;

    if (e.code === "Escape") {
      this.releaseAll();
      o.onReleaseAll?.();
      return; // never preventDefault: Escape must keep closing dialogs etc.
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat && !this.pedal) {
        this.pedal = true;
        o.onPedal?.(true, "keyboard:space");
      }
      return;
    }
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      e.preventDefault();
      if (!e.repeat) o.onOctaveShift?.(e.code === "ArrowLeft" ? -1 : 1);
      return;
    }

    const shortcut = o.chordShortcuts?.find((item) => item.code === e.code);
    const notes = shortcut
      ? [
          ...new Set(
            shortcut.notes
              .map((midi) => midi + o.transpose)
              .filter((midi) => midi >= 0 && midi <= 127),
          ),
        ]
      : (() => {
          const midi = codeToMidi(
            e.code,
            o.transpose,
            o.mapping ?? DEFAULT_MAPPING,
          );
          return midi === null ? [] : [midi];
        })();
    if (notes.length === 0) return; // unmapped: leave the browser alone
    e.preventDefault();
    if (e.repeat || this.down.has(e.code)) return; // auto-repeat must not retrigger
    this.down.set(e.code, notes);
    for (const midi of notes) o.onNoteOn(midi, `kbd:${e.code}`);
  }

  keyUp(e: KeyEventLike): void {
    const o = this.getOptions();
    if (e.code === "Space" && this.pedal) {
      e.preventDefault();
      this.pedal = false;
      o.onPedal?.(false, "keyboard:space");
    }
    const notes = this.down.get(e.code);
    if (notes === undefined) return;
    this.down.delete(e.code);
    for (const midi of notes) o.onNoteOff(midi, `kbd:${e.code}`);
  }

  /** Window blur, tab hidden, Escape, unmount. */
  releaseAll(): void {
    const o = this.getOptions();
    for (const [code, notes] of this.down)
      for (const midi of notes) o.onNoteOff(midi, `kbd:${code}`);
    this.down.clear();
    if (this.pedal) {
      this.pedal = false;
      o.onPedal?.(false, "keyboard:space");
    }
  }
}

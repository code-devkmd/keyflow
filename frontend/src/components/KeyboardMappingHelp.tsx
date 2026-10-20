import type { KeyMapping } from "../types/music";
import { codeLabel } from "../utils/keyboardMapping";
import { isBlackKey, midiToNoteName } from "../utils/musicTheory";

interface Props {
  transpose: number;
  mapping: KeyMapping;
  layoutMap?: ReadonlyMap<string, string> | null;
}

export function KeyboardMappingHelp({ transpose, mapping, layoutMap }: Props) {
  const entries = Object.entries(mapping)
    .map(([code, base]) => ({ code, midi: base + transpose }))
    .filter((e) => e.midi >= 0 && e.midi <= 127)
    .sort((a, b) => a.midi - b.midi);
  const row = (black: boolean) =>
    entries.filter((e) => isBlackKey(e.midi) === black);
  const chip = (e: { code: string; midi: number }) => (
    <li key={e.code} className="mapping-item">
      <kbd>{codeLabel(e.code, layoutMap)}</kbd>
      <span>{midiToNoteName(e.midi)}</span>
    </li>
  );
  return (
    <details className="mapping-panel">
      <summary>
        <span>
          <strong>Play with your computer keyboard</strong>
          <small>Shortcuts, controls and tips</small>
        </span>
        <span className="summary-arrow">⌄</span>
      </summary>
      <div className="mapping-content">
        <p className="mapping-explainer">
          Two-octave chromatic layout: lower octave uses Z–M for white notes and
          S, D, G, H, J for black notes; upper octave uses Q–I for white notes
          and 2, 3, 5, 6, 7 for black notes. Hold several keys together for
          chords. Use ← / → to move the entire mapping by octaves; labels on the
          piano update automatically.
        </p>
        <div className="mapping-grid">
          <div>
            <div className="mapping-label">WHITE KEYS</div>
            <ul>{row(false).map(chip)}</ul>
          </div>
          <div>
            <div className="mapping-label">BLACK KEYS</div>
            <ul>{row(true).map(chip)}</ul>
          </div>
        </div>
        <div className="shortcut-tips">
          <span>
            <kbd>Space</kbd> Sustain while held
          </span>
          <span>
            <kbd>←</kbd> <kbd>→</kbd> Shift octave (−3 to +3)
          </span>
          <span>
            <kbd>Esc</kbd> Release all notes
          </span>
        </div>
      </div>
    </details>
  );
}

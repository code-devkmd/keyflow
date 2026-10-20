import type { KeyMapping } from "@/shared/types/music";
import { codeLabel } from "@/shared/utils/keyboardMapping";
import { isBlackKey, midiToNoteName } from "@/shared/utils/musicTheory";

interface KeyboardMappingHelpProps {
  transpose: number;
  mapping: KeyMapping;
  layoutMap?: ReadonlyMap<string, string> | null;
}

export function KeyboardMappingHelp({
  transpose,
  mapping,
  layoutMap,
}: KeyboardMappingHelpProps) {
  const entries = Object.entries(mapping)
    .map(([code, baseMidiNote]) => ({
      code,
      midiNote: baseMidiNote + transpose,
    }))
    .filter(({ midiNote }) => midiNote >= 0 && midiNote <= 127)
    .sort((first, second) => first.midiNote - second.midiNote);

  const getRow = (blackKeys: boolean) =>
    entries.filter(({ midiNote }) => isBlackKey(midiNote) === blackKeys);
  const whiteKeys = getRow(false);
  const blackKeys = getRow(true);

  const renderKey = (entry: { code: string; midiNote: number }) => (
    <li key={entry.code} className="mapping-item">
      <kbd>{codeLabel(entry.code, layoutMap)}</kbd>
      <span>{midiToNoteName(entry.midiNote)}</span>
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
            <ul>{whiteKeys.map(renderKey)}</ul>
          </div>
          <div>
            <div className="mapping-label">BLACK KEYS</div>
            <ul>{blackKeys.map(renderKey)}</ul>
          </div>
        </div>

        <div className="shortcut-tips">
          <p>
            <kbd>Space</kbd> Hold sustain · <kbd>Esc</kbd> Release all notes
          </p>
          <p>
            <kbd>←</kbd> / <kbd>→</kbd> Shift the computer-key layout by an
            octave
          </p>
        </div>
      </div>
    </details>
  );
}

import { useMemo } from "react";
import { getOctave, isBlackKey, midiToNoteName } from "../utils/musicTheory";

interface Props {
  startMidi: number;
  octaves: number;
  activeNotes: ReadonlySet<number>;
  targetNotes?: ReadonlySet<number>;
  labels?: Map<number, string>;
  onNoteOn: (midi: number, source: string) => void;
  onNoteOff: (midi: number, source: string) => void;
}

export function PianoKeyboard({
  startMidi,
  octaves,
  activeNotes,
  targetNotes,
  labels,
  onNoteOn,
  onNoteOff,
}: Props) {
  const { whites, blacks, whiteCount } = useMemo(() => {
    const end = Math.min(127, startMidi + octaves * 12);
    const whites: number[] = [];
    const blacks: { midi: number; leftWhiteIndex: number }[] = [];
    for (let m = startMidi; m <= end; m++) {
      if (isBlackKey(m))
        blacks.push({ midi: m, leftWhiteIndex: whites.length - 1 });
      else whites.push(m);
    }
    return { whites, blacks, whiteCount: whites.length };
  }, [startMidi, octaves]);

  const w = 100 / whiteCount;
  const handlers = (midi: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      onNoteOn(midi, `ptr:${e.pointerId}`);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) =>
      onNoteOff(midi, `ptr:${e.pointerId}`),
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) =>
      onNoteOff(midi, `ptr:${e.pointerId}`),
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) =>
      onNoteOff(midi, `ptr:${e.pointerId}`),
    onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) =>
      e.preventDefault(),
  });

  return (
    <div
      className="keyboard-scroll"
      role="group"
      aria-label="Piano keyboard. Scroll horizontally to explore the full range."
    >
      <div className="piano-keys" style={{ minWidth: `${whiteCount * 42}px` }}>
        {whites.map((midi, i) => {
          const on = activeNotes.has(midi);
          const target = targetNotes?.has(midi);
          return (
            <button
              key={midi}
              type="button"
              tabIndex={-1}
              aria-label={`${midiToNoteName(midi)}${labels?.get(midi) ? `, computer key ${labels.get(midi)}` : ""}`}
              aria-pressed={on}
              {...handlers(midi)}
              style={{ left: `${i * w}%`, width: `${w}%` }}
              className={`piano-white-key ${on ? "key-active" : target ? "key-target" : ""}`}
            >
              <span className="key-note-label">
                {midi % 12 === 0 ? `C${getOctave(midi)}` : ""}
              </span>
              {labels?.get(midi) && (
                <span className="key-shortcut">{labels.get(midi)}</span>
              )}
            </button>
          );
        })}
        {blacks.map(({ midi, leftWhiteIndex }) => {
          const on = activeNotes.has(midi);
          const target = targetNotes?.has(midi);
          const bw = w * 0.62;
          return (
            <button
              key={midi}
              type="button"
              tabIndex={-1}
              aria-label={`${midiToNoteName(midi)}${labels?.get(midi) ? `, computer key ${labels.get(midi)}` : ""}`}
              aria-pressed={on}
              {...handlers(midi)}
              style={{
                left: `${(leftWhiteIndex + 1) * w - bw / 2}%`,
                width: `${bw}%`,
              }}
              className={`piano-black-key ${on ? "key-active" : target ? "key-target" : ""}`}
            >
              {labels?.get(midi) && (
                <span className="black-shortcut">{labels.get(midi)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

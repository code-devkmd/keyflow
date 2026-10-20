import { useMemo } from "react";
import type { PointerEvent, MouseEvent } from "react";
import {
  getOctave,
  isBlackKey,
  midiToNoteName,
} from "@/shared/utils/musicTheory";

interface PianoKeyboardProps {
  startMidi: number;
  octaves: number;
  activeNotes: ReadonlySet<number>;
  targetNotes?: ReadonlySet<number>;
  labels?: Map<number, string>;
  onNoteOn: (midiNote: number, source: string) => void;
  onNoteOff: (midiNote: number, source: string) => void;
}

export function PianoKeyboard({
  startMidi,
  octaves,
  activeNotes,
  targetNotes,
  labels,
  onNoteOn,
  onNoteOff,
}: PianoKeyboardProps) {
  const { whiteNotes, blackNotes, whiteKeyCount } = useMemo(() => {
    const endMidi = Math.min(127, startMidi + octaves * 12);
    const whiteNotes: number[] = [];
    const blackNotes: { midiNote: number; leftWhiteIndex: number }[] = [];

    for (let midiNote = startMidi; midiNote <= endMidi; midiNote += 1) {
      if (isBlackKey(midiNote)) {
        blackNotes.push({ midiNote, leftWhiteIndex: whiteNotes.length - 1 });
      } else {
        whiteNotes.push(midiNote);
      }
    }

    return {
      whiteNotes,
      blackNotes,
      whiteKeyCount: whiteNotes.length,
    };
  }, [startMidi, octaves]);

  const whiteKeyWidth = 100 / whiteKeyCount;

  const createPointerHandlers = (midiNote: number) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onNoteOn(midiNote, `ptr:${event.pointerId}`);
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      onNoteOff(midiNote, `ptr:${event.pointerId}`);
    },
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
      onNoteOff(midiNote, `ptr:${event.pointerId}`);
    },
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => {
      onNoteOff(midiNote, `ptr:${event.pointerId}`);
    },
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) =>
      event.preventDefault(),
  });

  return (
    <div
      className="keyboard-scroll"
      role="group"
      aria-label="Piano keyboard. Scroll horizontally to explore the full range."
    >
      <div
        className="piano-keys"
        style={{ minWidth: `${whiteKeyCount * 42}px` }}
      >
        {whiteNotes.map((midiNote, index) => {
          const isActive = activeNotes.has(midiNote);
          const isTarget = targetNotes?.has(midiNote);
          const noteLabel = labels?.get(midiNote);

          return (
            <button
              key={midiNote}
              type="button"
              tabIndex={-1}
              aria-label={`${midiToNoteName(midiNote)}${noteLabel ? `, computer key ${noteLabel}` : ""}`}
              aria-pressed={isActive}
              {...createPointerHandlers(midiNote)}
              style={{
                left: `${index * whiteKeyWidth}%`,
                width: `${whiteKeyWidth}%`,
              }}
              className={`piano-white-key ${isActive ? "key-active" : isTarget ? "key-target" : ""}`}
            >
              <span className="key-note-label">
                {midiNote % 12 === 0 ? `C${getOctave(midiNote)}` : ""}
              </span>
              {noteLabel && <span className="key-shortcut">{noteLabel}</span>}
            </button>
          );
        })}

        {blackNotes.map(({ midiNote, leftWhiteIndex }) => {
          const isActive = activeNotes.has(midiNote);
          const isTarget = targetNotes?.has(midiNote);
          const noteLabel = labels?.get(midiNote);
          const blackKeyWidth = whiteKeyWidth * 0.62;

          return (
            <button
              key={midiNote}
              type="button"
              tabIndex={-1}
              aria-label={`${midiToNoteName(midiNote)}${noteLabel ? `, computer key ${noteLabel}` : ""}`}
              aria-pressed={isActive}
              {...createPointerHandlers(midiNote)}
              style={{
                left: `${(leftWhiteIndex + 1) * whiteKeyWidth - blackKeyWidth / 2}%`,
                width: `${blackKeyWidth}%`,
              }}
              className={`piano-black-key ${isActive ? "key-active" : isTarget ? "key-target" : ""}`}
            >
              {noteLabel && <span className="black-shortcut">{noteLabel}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

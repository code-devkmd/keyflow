import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { midiToNoteName } from "../utils/musicTheory";
import {
  MidiImportError,
  parseMidi,
  validateMidiFile,
  type ParsedSong,
} from "../utils/midiImport";
import {
  currentStepIndex,
  matchStep,
  songToSteps,
  type Step,
} from "../utils/practiceSteps";

type Lesson = "melody" | "bass" | "song";
type RawStep = Omit<Step, "at">;
const withBeats = (raw: RawStep[]): Step[] =>
  raw.map((s, i) => ({ ...s, at: i })); // built-in lessons: one step per beat
const RANGES: Record<"melody" | "bass", [number, number]> = {
  melody: [69, 76],
  bass: [41, 57],
};

// Beginner exercise based on the user's supplied note sequence; not an official soundtrack transcription.
// Melody is played sequentially: A4, E5 (twice), then B4, E5, C5, E5, D5, E5.
const MELODY_RAW: RawStep[] = [
  { notes: [69], label: "A4" },
  { notes: [76], label: "E5" },
  { notes: [69], label: "A4" },
  { notes: [76], label: "E5" },
  { notes: [71], label: "B4" },
  { notes: [76], label: "E5" },
  { notes: [71], label: "B4" },
  { notes: [76], label: "E5" },
  { notes: [72], label: "C5" },
  { notes: [76], label: "E5" },
  { notes: [72], label: "C5" },
  { notes: [76], label: "E5" },
  { notes: [74], label: "D5" },
  { notes: [76], label: "E5" },
  { notes: [74], label: "D5" },
  { notes: [76], label: "E5" },
];
// Left-hand triads: F (F2+C3+F3), G (G2+D3+G3), Am (A2+E3+A3), each repeated.
const BASS_RAW: RawStep[] = [
  { notes: [41, 48, 53], label: "F2 + C3 + F3" },
  { notes: [41, 48, 53], label: "F2 + C3 + F3" },
  { notes: [43, 50, 55], label: "G2 + D3 + G3" },
  { notes: [43, 50, 55], label: "G2 + D3 + G3" },
  { notes: [45, 52, 57], label: "A2 + E3 + A3" },
  { notes: [45, 52, 57], label: "A2 + E3 + A3" },
];

const MELODY = withBeats(MELODY_RAW);
const BASS = withBeats(BASS_RAW);
const EMPTY_STEP: Step = { notes: [], label: "—", at: 0 };

interface Props {
  onTargetsChange: (notes: ReadonlySet<number>) => void;
  onRegisterNoteHandler: (handler: ((midi: number) => void) | null) => void;
}

export function PracticeMode({
  onTargetsChange,
  onRegisterNoteHandler,
}: Props) {
  const [lesson, setLesson] = useState<Lesson>("melody");
  const [bpm, setBpm] = useState(72);
  const [running, setRunning] = useState(false);
  const [loop, setLoop] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [message, setMessage] = useState(
    "Press Play, then follow the falling notes.",
  );
  const startAt = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const hitLedger = useRef(new Set<string>());
  const [song, setSong] = useState<ParsedSong | null>(null);
  const [trackSel, setTrackSel] = useState<"all" | number>("all");
  const [octShift, setOctShift] = useState(0);
  const [importMsg, setImportMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const steps = useMemo<Step[]>(() => {
    if (lesson === "melody") return MELODY;
    if (lesson === "bass") return BASS;
    if (!song) return [];
    const notes =
      trackSel === "all"
        ? song.notes
        : song.notes.filter((n) => n.track === trackSel);
    return songToSteps(notes, song.bpm, octShift);
  }, [lesson, song, trackSel, octShift]);
  const [lo, hi] = useMemo<[number, number]>(() => {
    if (lesson !== "song") return RANGES[lesson];
    const all = steps.flatMap((st) => st.notes);
    const min = Math.min(...all),
      max = Math.max(...all);
    return all.length ? [min, Math.max(max, min + 1)] : [60, 72];
  }, [lesson, steps]);
  const beat = 60 / bpm;
  const lastAt = steps.length ? steps[steps.length - 1].at : 0;
  const duration = (lastAt + 1) * beat;
  const stepIndex = steps.length ? currentStepIndex(steps, elapsed / beat) : 0;
  const current = steps[stepIndex] ?? EMPTY_STEP;
  const progress = Math.min(100, (elapsed / duration) * 100);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);
  useEffect(() => {
    onTargetsChange(new Set(running ? current.notes : []));
  }, [current, running, onTargetsChange]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (startAt.current === null)
        startAt.current = now - elapsedRef.current * 1000;
      const next = Math.max(0, (now - startAt.current) / 1000);
      if (next >= duration) {
        if (loop) {
          startAt.current = now;
          elapsedRef.current = 0;
          setElapsed(0);
          hitLedger.current.clear();
          setMessage("Looping — keep going!");
        } else {
          setElapsed(duration);
          setRunning(false);
          setMessage("Lesson complete. Great work!");
        }
      } else setElapsed(next);
    }, 30);
    return () => window.clearInterval(timer);
  }, [running, duration, loop]);

  const reset = useCallback(() => {
    setRunning(false);
    startAt.current = null;
    elapsedRef.current = 0;
    setElapsed(0);
    setHits(0);
    setMisses(0);
    hitLedger.current.clear();
    setMessage("Press Play, then follow the falling notes.");
  }, []);

  const handleNote = useCallback(
    (midi: number) => {
      if (!running) return;
      const hit = matchStep(
        steps,
        elapsedRef.current / beat,
        midi,
        hitLedger.current,
      );
      if (hit >= 0) {
        hitLedger.current.add(`${hit}:${midi}`);
        setHits((n) => n + 1);
        setMessage(`Nice — ${midiToNoteName(midi)}!`);
      } else {
        setMisses((n) => n + 1);
        setMessage(
          `You played ${midiToNoteName(midi)}. Target: ${current.label}`,
        );
      }
    },
    [running, beat, steps, current.label],
  );

  useEffect(() => {
    onRegisterNoteHandler(handleNote);
    return () => onRegisterNoteHandler(null);
  }, [handleNote, onRegisterNoteHandler]);

  const loadFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        validateMidiFile(file);
        const parsed = parseMidi(
          await file.arrayBuffer(),
          file.name.replace(/\.midi?$/i, ""),
        );
        reset();
        setSong(parsed);
        setTrackSel("all");
        setOctShift(0);
        setLesson("song");
        setBpm(Math.max(40, Math.min(160, parsed.bpm)));
        setImportMsg({
          ok: true,
          text: `Loaded “${parsed.title}”: ${parsed.notes.length} notes, ${parsed.tracks.length} track${parsed.tracks.length === 1 ? "" : "s"}.`,
        });
      } catch (err) {
        setImportMsg({
          ok: false,
          text:
            err instanceof MidiImportError
              ? err.message
              : "Something went wrong reading that file.",
        });
      }
    },
    [reset],
  );

  const falling = useMemo(() => {
    const items: Array<{
      id: string;
      midi: number;
      label: string;
      top: number;
      left: number;
    }> = [];
    const lead = beat * 3;
    steps.forEach((step, index) => {
      const due = step.at * beat;
      const top = ((due - elapsed + lead) / lead) * 82;
      if (top < -12 || top > 90) return;
      step.notes.forEach((midi) => {
        const pitchPosition = (midi - lo) / (hi - lo);
        items.push({
          id: `${index}-${midi}`,
          midi,
          label: midiToNoteName(midi),
          top,
          left: 8 + Math.max(0, Math.min(1, pitchPosition)) * 84,
        });
      });
    });
    return items;
  }, [steps, beat, elapsed, lo, hi]);

  return (
    <section className="practice-panel" aria-label="Music practice mode">
      <div className="practice-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> GUIDED PRACTICE
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            Learn the pattern, one note at a time.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
            Follow the falling notes to the line, then play them on the piano
            below or with your computer keyboard. This is a beginner exercise
            based on the pattern you shared, not an official soundtrack
            transcription.
          </p>
        </div>
        <div className="practice-score">
          <strong>{hits}</strong>
          <span>HITS</span>
          <i /> <strong>{misses}</strong>
          <span>TRIES</span>
        </div>
      </div>

      <div className="practice-toolbar">
        <div
          className="practice-switch"
          role="group"
          aria-label="Practice part"
        >
          <button
            type="button"
            className={lesson === "melody" ? "selected" : ""}
            onClick={() => {
              reset();
              setLesson("melody");
            }}
          >
            Right-hand melody
          </button>
          <button
            type="button"
            className={lesson === "bass" ? "selected" : ""}
            onClick={() => {
              reset();
              setLesson("bass");
            }}
          >
            Left-hand bass
          </button>
          {song && (
            <button
              type="button"
              className={lesson === "song" ? "selected" : ""}
              onClick={() => {
                reset();
                setLesson("song");
              }}
            >
              Your MIDI
            </button>
          )}
        </div>
        <label className="tempo-control">
          Tempo <strong>{bpm} BPM</strong>
          <input
            aria-label="Practice tempo"
            type="range"
            min="40"
            max="160"
            step="4"
            value={bpm}
            onChange={(e) => {
              const wasRunning = running;
              setBpm(Number(e.target.value));
              if (wasRunning) {
                startAt.current = performance.now() - elapsedRef.current * 1000;
              }
            }}
          />
        </label>
        <label className="loop-toggle">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
          />{" "}
          Loop lesson
        </label>
      </div>

      <div
        className={`midi-import ${dragging ? "midi-import-drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          loadFile(e.dataTransfer.files[0]);
        }}
      >
        <label className="midi-import-button">
          Import MIDI song
          <input
            type="file"
            accept=".mid,.midi,audio/midi"
            aria-label="Import a MIDI file"
            onChange={(e) => {
              loadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <span className="midi-import-hint">
          or drop a .mid file here (max 2 MB). Only MIDI files are supported;
          MP3/WAV are not.
        </span>
        {song && lesson === "song" && (
          <div className="midi-import-options">
            <label>
              Track{" "}
              <select
                value={String(trackSel)}
                onChange={(e) => {
                  reset();
                  setTrackSel(
                    e.target.value === "all" ? "all" : Number(e.target.value),
                  );
                }}
              >
                <option value="all">All tracks</option>
                {song.tracks.map((t) => (
                  <option key={t.index} value={t.index}>
                    {t.name} ({t.noteCount})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Octave{" "}
              <select
                value={octShift}
                onChange={(e) => {
                  reset();
                  setOctShift(Number(e.target.value));
                }}
              >
                {[-2, -1, 0, 1, 2].map((o) => (
                  <option key={o} value={o}>
                    {o > 0 ? `+${o}` : o}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {importMsg && (
          <p
            role={importMsg.ok ? "status" : "alert"}
            className={importMsg.ok ? "midi-ok" : "midi-err"}
          >
            {importMsg.text}
          </p>
        )}
      </div>

      <div className="falling-stage" aria-label="Falling note guide">
        <div className="falling-lanes" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        {falling.map((item) => (
          <div
            key={item.id}
            className={`falling-note ${current.notes.includes(item.midi) && Math.abs(item.top - 82) < 35 ? "falling-note-current" : ""}`}
            style={{ top: `${item.top}%`, left: `${item.left}%` }}
          >
            <span>{item.label}</span>
          </div>
        ))}
        <div className="hit-line">
          <span>PLAY HERE</span>
        </div>
        <div className="stage-hint">{current.label}</div>
      </div>
      <div className="practice-progress">
        <div style={{ width: `${progress}%` }} />
      </div>
      <div className="practice-bottom">
        <p className="practice-feedback" aria-live="polite">
          {message}
        </p>
        <div className="practice-actions">
          <button
            type="button"
            className="practice-primary"
            disabled={steps.length === 0}
            onClick={() => {
              if (!running) {
                if (elapsed >= duration) {
                  elapsedRef.current = 0;
                  setElapsed(0);
                }
                startAt.current = performance.now() - elapsedRef.current * 1000;
                setRunning(true);
                setMessage("Listen and play along.");
              } else {
                setRunning(false);
                startAt.current = null;
                setMessage("Paused. Press Play to continue.");
              }
            }}
          >
            {running
              ? "Ⅱ Pause"
              : elapsed > 0 && elapsed < duration
                ? "▶ Resume"
                : "▶ Play lesson"}
          </button>
          <button type="button" className="practice-secondary" onClick={reset}>
            ↺ Restart
          </button>
        </div>
      </div>
      <div className="practice-next">
        <span>NEXT UP</span>
        <strong>{current.label}</strong>
        <small>
          {lesson === "melody"
            ? "Set octave shift to +1: N=A4, E=E5, M=B4, Q=C5, W=D5"
            : lesson === "bass"
              ? "Set octave shift to −1; play the three notes of each chord together"
              : steps.length
                ? `${song?.title} · range ${midiToNoteName(lo)}–${midiToNoteName(Math.max(...steps.flatMap((st) => st.notes)))}. Computer keys cover two octaves at a time; use ← / → to shift the range.`
                : "No notes in range. Try a different octave or track."}
        </small>
      </div>
      {(lesson === "bass" || lesson === "melody") && (
        <div className="practice-technical-note">
          {lesson === "melody"
            ? "Melody shortcuts: set octave shift to +1. Press N=A4, E=E5, M=B4, Q=C5, and W=D5 in the shown sequence."
            : "Bass shortcuts: set octave shift to −1. F chord = V + Q + R; G chord = B + W + T; Am chord = N + E + Y. Hold each three-key group together."}
        </div>
      )}
      <div className="sr-only">
        {stepIndex + 1} of {steps.length} practice steps
      </div>
    </section>
  );
}

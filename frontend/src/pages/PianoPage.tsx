import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioControls } from "../components/AudioControls";
import {
  ChordShortcuts,
  type ChordShortcut,
} from "../components/ChordShortcuts";
import { PracticeMode } from "../components/PracticeMode";
import { KeyboardMappingHelp } from "../components/KeyboardMappingHelp";
import { PianoKeyboard } from "../components/PianoKeyboard";
import { usePhysicalKeyboard } from "../hooks/usePhysicalKeyboard";
import { usePianoAudio } from "../hooks/usePianoAudio";
import {
  DEFAULT_MAPPING,
  loadLayoutMap,
  midiToLabels,
} from "../utils/keyboardMapping";
import { midiToFrequency, midiToNoteName } from "../utils/musicTheory";

export function PianoPage() {
  const audio = usePianoAudio();
  const [octaves, setOctaves] = useState(4);
  const [mode, setMode] = useState<"free" | "practice">("free");
  const [practiceTargets, setPracticeTargets] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const practiceHandler = useRef<((midi: number) => void) | null>(null);
  const registerPracticeHandler = useCallback(
    (handler: ((midi: number) => void) | null) => {
      practiceHandler.current = handler;
    },
    [],
  );
  const reportPracticeNote = useCallback(
    (midi: number) => {
      if (mode === "practice") practiceHandler.current?.(midi);
    },
    [mode],
  );
  const playNoteOn = useCallback(
    (midi: number, source: string) => {
      audio.noteOn(midi, source);
      reportPracticeNote(midi);
    },
    [audio.noteOn, reportPracticeNote],
  );
  const [shift, setShift] = useState(0);
  const [chordShortcuts, setChordShortcuts] = useState<ChordShortcut[]>(() => {
    try {
      const stored = localStorage.getItem("keyflow-chord-shortcuts-v1");
      const parsed = stored ? (JSON.parse(stored) as ChordShortcut[]) : [];
      return Array.isArray(parsed)
        ? parsed.filter(
            (item) =>
              typeof item?.code === "string" &&
              Array.isArray(item.notes) &&
              item.notes.every(
                (n) => Number.isInteger(n) && n >= 0 && n <= 127,
              ),
          )
        : [];
    } catch {
      return [];
    }
  });
  const [layoutMap, setLayoutMap] = useState<ReadonlyMap<
    string,
    string
  > | null>(null);
  const transpose = shift * 12;

  useEffect(() => {
    loadLayoutMap().then(setLayoutMap);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "keyflow-chord-shortcuts-v1",
        JSON.stringify(chordShortcuts),
      );
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  }, [chordShortcuts]);

  usePhysicalKeyboard({
    transpose,
    mapping: DEFAULT_MAPPING,
    chordShortcuts,
    onNoteOn: playNoteOn,
    onNoteOff: audio.noteOff,
    onPedal: audio.setPedalHeld,
    onOctaveShift: (d) => setShift((s) => Math.max(-3, Math.min(3, s + d))),
    onReleaseAll: audio.releaseAll,
  });

  const labels = useMemo(
    () => midiToLabels(transpose, DEFAULT_MAPPING, layoutMap),
    [transpose, layoutMap],
  );
  const active = [...audio.activeNotes].sort((a, b) => a - b);
  const latestNote = active.length
    ? midiToNoteName(active[active.length - 1])
    : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="studio-intro">
        <div className="min-w-0">
          <div className="eyebrow">
            <span className="eyebrow-line" /> MAKE SOMETHING BEAUTIFUL
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Your piano.
            <br className="sm:hidden" /> Your moment.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400 sm:text-base">
            Play freely with your computer keyboard or tap the keys below. Hold
            a few notes together, find a melody, and see where it takes you.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-stone-400">
            <span className="feature-chip">
              <span className="feature-icon">⌨</span> Computer keyboard
            </span>
            <span className="feature-chip">
              <span className="feature-icon">♫</span> Chords & melodies
            </span>
            <span className="feature-chip">
              <span className="feature-icon">↗</span> Sustain pedal
            </span>
          </div>
        </div>
        <div className="sound-card">
          <div className="flex items-center justify-between">
            <span className="eyebrow">INSTRUMENT STATUS</span>
            <span
              className={`status-dot ${audio.status === "ready" ? "status-ready" : audio.status === "error" ? "status-error" : ""}`}
            />
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-xl font-medium text-white">
                {audio.status === "ready"
                  ? "Ready to play"
                  : audio.status === "loading"
                    ? "Waking up…"
                    : audio.status === "error"
                      ? "Sound needs attention"
                      : "Waiting for your first note"}
              </div>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                {audio.status === "ready"
                  ? "Audio engine is running"
                  : "Tap a piano key or press a mapped letter"}
              </p>
            </div>
            <div className="sound-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      </section>

      <div className="mode-switch" role="tablist" aria-label="Piano mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "free"}
          className={mode === "free" ? "mode-tab selected" : "mode-tab"}
          onClick={() => {
            setMode("free");
            setPracticeTargets(new Set());
          }}
        >
          ♫ Free play
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "practice"}
          className={mode === "practice" ? "mode-tab selected" : "mode-tab"}
          onClick={() => setMode("practice")}
        >
          ✦ Music practice
        </button>
      </div>
      {mode === "practice" && (
        <PracticeMode
          onTargetsChange={setPracticeTargets}
          onRegisterNoteHandler={registerPracticeHandler}
        />
      )}

      {audio.status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-900/80 bg-red-950/50 p-4 text-sm text-red-200"
        >
          <strong>Audio could not start.</strong> {audio.error}. Try tapping a
          piano key again, or check your browser's audio permissions.
          <button
            onClick={audio.init}
            className="ml-3 underline underline-offset-4"
          >
            Retry audio
          </button>
        </div>
      )}
      {audio.status === "idle" && (
        <button onClick={audio.init} className="audio-nudge w-full text-left">
          <span className="nudge-play" aria-hidden="true">
            ▶
          </span>
          <span>
            <strong className="block text-sm text-stone-100">
              Turn on the sound
            </strong>
            <span className="mt-0.5 block text-xs text-stone-400">
              One click to wake up the audio engine. Then you're free to play.
            </span>
          </span>
          <span className="ml-auto hidden text-xs text-amber-300 sm:block">
            START PLAYING ↗
          </span>
        </button>
      )}

      <section className="instrument-panel">
        <div className="instrument-topline">
          <div>
            <div className="eyebrow">THE INSTRUMENT</div>
            <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
              Concert piano{" "}
              <span className="ml-1 text-sm font-normal text-stone-500">
                / virtual
              </span>
            </h2>
          </div>
          <div
            className="note-readout"
            aria-live="polite"
            aria-label="Currently played notes"
          >
            <span className="readout-label">
              {active.length > 1 ? "CHORD / NOTES" : "NOW PLAYING"}
            </span>
            <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
              {active.length ? (
                active.map((m) => (
                  <span key={m} className="note-badge">
                    {midiToNoteName(m)}
                  </span>
                ))
              ) : (
                <span className="readout-empty">—</span>
              )}
            </div>
          </div>
        </div>
        <div className="piano-frame">
          <div className="piano-brandline">
            <span>KEYFLOW</span>
            <span>
              {latestNote
                ? `${latestNote} · ${midiToFrequency(active[active.length - 1]).toFixed(1)} HZ`
                : "88-KEY INSPIRED LAYOUT"}
            </span>
          </div>
          <PianoKeyboard
            startMidi={Math.max(0, 48 + shift * 12)}
            octaves={octaves}
            activeNotes={audio.activeNotes}
            targetNotes={mode === "practice" ? practiceTargets : undefined}
            labels={labels}
            onNoteOn={playNoteOn}
            onNoteOff={audio.noteOff}
          />
          <div className="piano-bottomline">
            <span>LOW NOTES</span>
            <span>HIGH NOTES</span>
          </div>
        </div>
        <AudioControls
          volume={audio.volume}
          onVolume={audio.setVolume}
          releaseDuration={audio.releaseDuration}
          onReleaseDuration={audio.setReleaseDuration}
          sustain={audio.sustainLatched || audio.pedalHeld}
          onSustain={audio.setSustainLatched}
          octaves={octaves}
          onOctaves={(n) => setOctaves(Math.max(2, Math.min(7, n)))}
          shift={shift}
          onShift={(n) => setShift(Math.max(-3, Math.min(3, n)))}
        />
      </section>
      <ChordShortcuts shortcuts={chordShortcuts} onChange={setChordShortcuts} />
      <KeyboardMappingHelp
        transpose={transpose}
        mapping={DEFAULT_MAPPING}
        layoutMap={layoutMap}
      />
      <p className="text-center text-xs leading-5 text-stone-600">
        Tip: for a more piano-like feel, try headphones and use sustain for
        long, connected notes. This version uses a synthesized piano-like tone;
        sampled piano sound can be added as a next step.
      </p>
    </div>
  );
}

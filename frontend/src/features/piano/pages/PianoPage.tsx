import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InstrumentMode } from "@/audio/audioEngine";
import { MidiInputPanel } from "@/features/midi/MidiInputPanel";
import { useMidiInput } from "@/features/midi/useMidiInput";
import { PerformancePanel } from "@/features/performance/PerformancePanel";
import { usePerformanceRecorder } from "@/features/performance/usePerformanceRecorder";
import { PracticeMode } from "@/features/practice/PracticeMode";
import { AudioControls } from "@/features/piano/components/AudioControls";
import { KeyboardMappingHelp } from "@/features/piano/components/KeyboardMappingHelp";
import { PianoKeyboard } from "@/features/piano/components/PianoKeyboard";
import { usePhysicalKeyboard } from "@/features/piano/hooks/usePhysicalKeyboard";
import { usePianoAudio } from "@/features/piano/hooks/usePianoAudio";
import {
  ChordShortcuts,
  type ChordShortcut,
  type ShortcutBank,
} from "@/features/shortcuts/ChordShortcuts";
import {
  DEFAULT_MAPPING,
  loadLayoutMap,
  midiToLabels,
} from "@/shared/utils/keyboardMapping";
import { midiToFrequency, midiToNoteName } from "@/shared/utils/musicTheory";

function loadShortcutBanks(): ShortcutBank[] {
  const isValidShortcut = (shortcut: unknown): shortcut is ChordShortcut => {
    const item = shortcut as Partial<ChordShortcut> | null;
    return Boolean(
      item &&
      typeof item.code === "string" &&
      Array.isArray(item.notes) &&
      item.notes.every(
        (note) => Number.isInteger(note) && note >= 0 && note <= 127,
      ),
    );
  };

  try {
    const savedBanks = localStorage.getItem("keyflow-shortcut-banks-v1");
    if (savedBanks) {
      const parsedBanks = JSON.parse(savedBanks) as ShortcutBank[];
      const validBanks = Array.isArray(parsedBanks)
        ? parsedBanks.filter(
            (bank) =>
              typeof bank?.id === "string" &&
              typeof bank?.name === "string" &&
              Array.isArray(bank.shortcuts) &&
              bank.shortcuts.every(isValidShortcut),
          )
        : [];

      if (validBanks.length > 0) return validBanks;
    }

    // Migrate shortcuts created by earlier KeyFlow versions into the first bank.
    const legacyShortcuts = localStorage.getItem("keyflow-chord-shortcuts-v1");
    const parsedLegacy = legacyShortcuts
      ? (JSON.parse(legacyShortcuts) as unknown[])
      : [];
    const validLegacy = Array.isArray(parsedLegacy)
      ? parsedLegacy.filter(isValidShortcut)
      : [];

    return [{ id: "main", name: "Main", shortcuts: validLegacy }];
  } catch {
    return [{ id: "main", name: "Main", shortcuts: [] }];
  }
}

export function PianoPage() {
  const audio = usePianoAudio();
  const recorder = usePerformanceRecorder();

  const [octaves, setOctaves] = useState(4);
  const [shift, setShift] = useState(0);
  const [mode, setMode] = useState<"free" | "practice">("free");
  const [liveMode, setLiveMode] = useState(false);
  const [practiceTargets, setPracticeTargets] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const [instrumentError, setInstrumentError] = useState<string | null>(null);
  const [isChangingInstrument, setIsChangingInstrument] = useState(false);
  const [shortcutBanks, setShortcutBanks] =
    useState<ShortcutBank[]>(loadShortcutBanks);
  const [activeShortcutBankId, setActiveShortcutBankId] = useState(() => {
    try {
      return localStorage.getItem("keyflow-active-shortcut-bank-v1") || "main";
    } catch {
      return "main";
    }
  });
  const [layoutMap, setLayoutMap] = useState<ReadonlyMap<
    string,
    string
  > | null>(null);

  const requestedFullscreen = useRef(false);
  const practiceHandler = useRef<((midiNote: number) => void) | null>(null);
  const transpose = shift * 12;
  const activeShortcutBank =
    shortcutBanks.find((bank) => bank.id === activeShortcutBankId) ??
    shortcutBanks[0];
  const chordShortcuts = activeShortcutBank?.shortcuts ?? [];
  const activeNotes = [...audio.activeNotes].sort(
    (first, second) => first - second,
  );
  const latestNote = activeNotes.length
    ? midiToNoteName(activeNotes[activeNotes.length - 1])
    : null;

  const registerPracticeHandler = useCallback(
    (handler: ((midiNote: number) => void) | null) => {
      practiceHandler.current = handler;
    },
    [],
  );

  const reportPracticeNote = useCallback(
    (midiNote: number) => {
      if (mode === "practice") practiceHandler.current?.(midiNote);
    },
    [mode],
  );

  const playNoteOn = useCallback(
    (midiNote: number, source: string, velocity = 0.8) => {
      audio.noteOn(midiNote, source, velocity);
      recorder.recordNoteOn(midiNote, source, velocity);
      if (!source.startsWith("playback:")) reportPracticeNote(midiNote);
    },
    [audio.noteOn, recorder.recordNoteOn, reportPracticeNote],
  );

  const playNoteOff = useCallback(
    (midiNote: number, source: string) => {
      audio.noteOff(midiNote, source);
      recorder.recordNoteOff(midiNote, source);
    },
    [audio.noteOff, recorder.recordNoteOff],
  );

  const updateChordShortcuts = useCallback(
    (shortcuts: ChordShortcut[]) => {
      setShortcutBanks((banks) =>
        banks.map((bank) =>
          bank.id === activeShortcutBankId ? { ...bank, shortcuts } : bank,
        ),
      );
    },
    [activeShortcutBankId],
  );

  const createShortcutBank = useCallback(() => {
    const bankId = `bank-${Date.now()}`;
    setShortcutBanks((banks) => [
      ...banks,
      {
        id: bankId,
        name: `Bank ${banks.length + 1}`,
        shortcuts: [],
      },
    ]);
    setActiveShortcutBankId(bankId);
  }, []);

  const renameActiveShortcutBank = useCallback(() => {
    if (!activeShortcutBank) return;
    const proposedName = window.prompt(
      "Name this shortcut bank",
      activeShortcutBank.name,
    );
    const name = proposedName?.trim();
    if (!name) return;

    setShortcutBanks((banks) =>
      banks.map((bank) =>
        bank.id === activeShortcutBank.id ? { ...bank, name } : bank,
      ),
    );
  }, [activeShortcutBank]);

  const handleInstrumentModeChange = useCallback(
    async (instrumentMode: InstrumentMode) => {
      setInstrumentError(null);
      setIsChangingInstrument(true);

      try {
        await audio.setInstrumentMode(instrumentMode);
      } catch (error) {
        setInstrumentError(
          error instanceof Error
            ? error.message
            : "Could not load this piano sound.",
        );
      } finally {
        setIsChangingInstrument(false);
      }
    },
    [audio.setInstrumentMode],
  );

  const toggleLiveMode = useCallback(() => {
    if (liveMode) {
      setLiveMode(false);
      requestedFullscreen.current = false;
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
      return;
    }

    setLiveMode(true);
    if (document.documentElement.requestFullscreen) {
      requestedFullscreen.current = true;
      void document.documentElement.requestFullscreen().catch(() => {
        requestedFullscreen.current = false;
      });
    }
  }, [liveMode]);

  const midiInput = useMidiInput({
    onNoteOn: playNoteOn,
    onNoteOff: playNoteOff,
    onPedal: audio.setPedalHeld,
  });

  useEffect(() => {
    loadLayoutMap().then(setLayoutMap);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "keyflow-shortcut-banks-v1",
        JSON.stringify(shortcutBanks),
      );
      localStorage.setItem(
        "keyflow-active-shortcut-bank-v1",
        activeShortcutBank?.id ?? "main",
      );
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, [shortcutBanks, activeShortcutBank?.id]);

  useEffect(() => {
    if (
      !shortcutBanks.some((bank) => bank.id === activeShortcutBankId) &&
      shortcutBanks[0]
    ) {
      setActiveShortcutBankId(shortcutBanks[0].id);
    }
  }, [shortcutBanks, activeShortcutBankId]);

  useEffect(() => {
    document.body.classList.toggle("keyflow-live-mode", liveMode);
    return () => document.body.classList.remove("keyflow-live-mode");
  }, [liveMode]);

  useEffect(() => {
    const syncFullscreenState = () => {
      if (requestedFullscreen.current && !document.fullscreenElement) {
        requestedFullscreen.current = false;
        setLiveMode(false);
      }
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  usePhysicalKeyboard({
    transpose,
    mapping: DEFAULT_MAPPING,
    chordShortcuts,
    onNoteOn: playNoteOn,
    onNoteOff: playNoteOff,
    onPedal: audio.setPedalHeld,
    onOctaveShift: (delta) =>
      setShift((currentShift) =>
        Math.max(-3, Math.min(3, currentShift + delta)),
      ),
    onReleaseAll: audio.releaseAll,
  });

  const keyboardLabels = useMemo(
    () => midiToLabels(transpose, DEFAULT_MAPPING, layoutMap),
    [transpose, layoutMap],
  );

  return (
    <div
      className={`piano-page space-y-5 sm:space-y-6 ${liveMode ? "live-mode" : ""}`}
    >
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

      <div className="mode-toolbar">
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
        {liveMode && shortcutBanks.length > 1 && (
          <label className="live-bank-picker">
            <span className="sr-only">Active shortcut bank</span>
            <select
              value={activeShortcutBank?.id ?? "main"}
              onChange={(event) => setActiveShortcutBankId(event.target.value)}
              aria-label="Active shortcut bank"
            >
              {shortcutBanks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className={liveMode ? "live-mode-button active" : "live-mode-button"}
          onClick={toggleLiveMode}
          aria-pressed={liveMode}
        >
          <span aria-hidden="true">◉</span>{" "}
          {liveMode ? "Exit Live Mode" : "Live Mode"}
        </button>
      </div>

      {mode === "practice" && !liveMode && (
        <PracticeMode
          onTargetsChange={setPracticeTargets}
          onRegisterNoteHandler={registerPracticeHandler}
        />
      )}

      <div className="live-tools-grid">
        <MidiInputPanel
          devices={midiInput.devices}
          isSupported={midiInput.isSupported}
          isConnected={midiInput.isConnected}
          error={midiInput.error}
          onConnect={() => void midiInput.connect()}
          onDisconnect={midiInput.disconnect}
          compact={liveMode}
        />
        <PerformancePanel
          eventCount={recorder.events.length}
          durationMs={recorder.durationMs}
          isRecording={recorder.isRecording}
          isPlaying={recorder.isPlaying}
          onStartRecording={recorder.startRecording}
          onStopRecording={recorder.stopRecording}
          onPlay={() =>
            recorder.playRecording({
              onNoteOn: playNoteOn,
              onNoteOff: playNoteOff,
            })
          }
          onStopPlayback={recorder.stopPlayback}
          onClear={recorder.clearRecording}
          onDownload={recorder.downloadRecording}
        />
      </div>

      {audio.status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-900/80 bg-red-950/50 p-4 text-sm text-red-200"
        >
          <strong>Audio could not start.</strong> {audio.error}. Try tapping a
          piano key again, or check your browser&apos;s audio permissions.
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
              One click to wake up the audio engine. Then you&apos;re free to
              play.
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

          <div className="instrument-actions">
            <button
              type="button"
              className="panic-button"
              onClick={audio.releaseAll}
            >
              Release all
            </button>
            <div
              className="note-readout"
              aria-live="polite"
              aria-label="Currently played notes"
            >
              <span className="readout-label">
                {activeNotes.length > 1 ? "CHORD / NOTES" : "NOW PLAYING"}
              </span>
              <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
                {activeNotes.length ? (
                  activeNotes.map((midiNote) => (
                    <span key={midiNote} className="note-badge">
                      {midiToNoteName(midiNote)}
                    </span>
                  ))
                ) : (
                  <span className="readout-empty">—</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="piano-frame">
          <div className="piano-brandline">
            <span>KEYFLOW</span>
            <span>
              {latestNote
                ? `${latestNote} · ${midiToFrequency(activeNotes[activeNotes.length - 1]).toFixed(1)} HZ`
                : "88-KEY INSPIRED LAYOUT"}
            </span>
          </div>
          <PianoKeyboard
            startMidi={Math.max(0, 48 + shift * 12)}
            octaves={octaves}
            activeNotes={audio.activeNotes}
            targetNotes={mode === "practice" ? practiceTargets : undefined}
            labels={keyboardLabels}
            onNoteOn={playNoteOn}
            onNoteOff={playNoteOff}
          />
          <div className="piano-bottomline">
            <span>LOW NOTES</span>
            <span>HIGH NOTES</span>
          </div>
        </div>

        <AudioControls
          volume={audio.volume}
          onVolume={audio.setVolume}
          reverbAmount={audio.reverbAmount}
          onReverbAmount={audio.setReverbAmount}
          releaseDuration={audio.releaseDuration}
          onReleaseDuration={audio.setReleaseDuration}
          sustain={audio.sustainLatched || audio.pedalHeld}
          onSustain={audio.setSustainLatched}
          octaves={octaves}
          onOctaves={(count) => setOctaves(Math.max(2, Math.min(7, count)))}
          shift={shift}
          onShift={(octaveShift) =>
            setShift(Math.max(-3, Math.min(3, octaveShift)))
          }
          instrumentMode={audio.instrumentMode}
          onInstrumentMode={(nextMode) =>
            void handleInstrumentModeChange(nextMode)
          }
          isChangingInstrument={isChangingInstrument}
          instrumentError={instrumentError}
        />
      </section>

      {!liveMode && activeShortcutBank && (
        <ChordShortcuts
          shortcuts={chordShortcuts}
          banks={shortcutBanks.map(({ id, name }) => ({ id, name }))}
          activeBankId={activeShortcutBank.id}
          onSelectBank={setActiveShortcutBankId}
          onCreateBank={createShortcutBank}
          onRenameBank={renameActiveShortcutBank}
          onChange={updateChordShortcuts}
        />
      )}
      {!liveMode && (
        <KeyboardMappingHelp
          transpose={transpose}
          mapping={DEFAULT_MAPPING}
          layoutMap={layoutMap}
        />
      )}
      {!liveMode && (
        <p className="text-center text-xs leading-5 text-stone-600">
          Tip: headphones, a MIDI controller, and sustain can make performances
          feel more connected. Sampled piano mode downloads audio samples when
          selected.
        </p>
      )}
    </div>
  );
}

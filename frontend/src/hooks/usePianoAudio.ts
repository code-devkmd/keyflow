import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { audioEngine } from "../services/audioEngine";

/**
 * React binding for the audio engine. Tracks which input "sources" (keyboard codes, pointer ids)
 * hold each note, so a note is only released when its last holder lets go.
 */
export function usePianoAudio() {
  const status = useSyncExternalStore(
    (cb) => audioEngine.subscribe(cb),
    () => audioEngine.status,
  );
  const error = useSyncExternalStore(
    (cb) => audioEngine.subscribe(cb),
    () => audioEngine.error,
  );
  const holders = useRef(new Map<number, Set<string>>());
  const [activeNotes, setActiveNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const [volume, setVolumeState] = useState(0.8);
  const [releaseDuration, setReleaseDurationState] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("keyflow-note-release-v1"));
      return Number.isFinite(saved) && saved >= 0.2 && saved <= 4 ? saved : 1.6;
    } catch {
      return 1.6;
    }
  });
  const [latched, setLatched] = useState(false);
  const [pedalHeld, setPedalHeld] = useState(false);

  const publish = useCallback(
    () => setActiveNotes(new Set(holders.current.keys())),
    [],
  );

  const noteOn = useCallback(
    (midi: number, source: string, velocity = 0.8) => {
      let set = holders.current.get(midi);
      if (!set) holders.current.set(midi, (set = new Set()));
      if (set.has(source)) return;
      set.add(source);
      publish();
      const play = () => {
        // The key may have been released while audio was still initialising.
        if (holders.current.has(midi)) audioEngine.noteOn(midi, velocity);
      };
      if (audioEngine.ready) {
        play();
      } else {
        audioEngine
          .init()
          .then(play)
          .catch(() => {});
      }
    },
    [publish],
  );

  const noteOff = useCallback(
    (midi: number, source: string) => {
      const set = holders.current.get(midi);
      if (!set || !set.delete(source)) return;
      if (set.size === 0) {
        holders.current.delete(midi);
        audioEngine.noteOff(midi);
      }
      publish();
    },
    [publish],
  );

  const releaseAll = useCallback(() => {
    holders.current.clear();
    audioEngine.releaseAll();
    setPedalHeld(false);
    publish();
  }, [publish]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    audioEngine.setVolume(v);
  }, []);

  const setReleaseDuration = useCallback((seconds: number) => {
    const value = Math.min(4, Math.max(0.2, seconds));
    setReleaseDurationState(value);
    audioEngine.setReleaseDuration(value);
    try {
      localStorage.setItem("keyflow-note-release-v1", String(value));
    } catch {
      /* Storage may be unavailable. */
    }
  }, []);

  useEffect(() => {
    audioEngine.setReleaseDuration(releaseDuration);
  }, [releaseDuration]);

  useEffect(() => {
    audioEngine.setSustain(latched || pedalHeld);
  }, [latched, pedalHeld]);

  // Stuck-note prevention: tab hidden or window loses focus -> release everything.
  useEffect(() => {
    const onHide = () => releaseAll();
    const onVis = () => document.hidden && releaseAll();
    window.addEventListener("blur", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", onHide);
      document.removeEventListener("visibilitychange", onVis);
      releaseAll(); // unmount (e.g. switching modes)
    };
  }, [releaseAll]);

  return {
    status,
    error,
    activeNotes,
    volume,
    setVolume,
    releaseDuration,
    setReleaseDuration,
    sustainLatched: latched,
    setSustainLatched: setLatched,
    pedalHeld,
    setPedalHeld,
    noteOn,
    noteOff,
    releaseAll,
    init: () => audioEngine.init().catch(() => {}),
  };
}

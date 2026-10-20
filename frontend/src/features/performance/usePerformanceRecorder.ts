import { useCallback, useEffect, useRef, useState } from "react";

export interface PerformanceEvent {
  type: "note-on" | "note-off";
  midiNote: number;
  timeMs: number;
  source: string;
  velocity?: number;
}

interface PlaybackCallbacks {
  onNoteOn: (midiNote: number, source: string, velocity?: number) => void;
  onNoteOff: (midiNote: number, source: string) => void;
}

const PLAYBACK_SOURCE_PREFIX = "playback:";

/** Records note events and replays their original timing without recording playback again. */
export function usePerformanceRecorder() {
  const [events, setEvents] = useState<PerformanceEvent[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const recordingStartedAt = useRef(0);
  const eventsRef = useRef<PerformanceEvent[]>([]);
  const recordingRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const activePlaybackNotes = useRef(
    new Map<string, { midiNote: number; source: string }>(),
  );
  const activeRecordingNotes = useRef(
    new Map<string, { midiNote: number; source: string }>(),
  );
  const playbackCallbacks = useRef<PlaybackCallbacks | null>(null);

  const publishEvents = useCallback((nextEvents: PerformanceEvent[]) => {
    eventsRef.current = nextEvents;
    setEvents(nextEvents);
    const finalEventTime = nextEvents.reduce(
      (latest, event) => Math.max(latest, event.timeMs),
      0,
    );
    setDurationMs(finalEventTime);
  }, []);

  const record = useCallback(
    (event: Omit<PerformanceEvent, "timeMs">) => {
      if (
        !recordingRef.current ||
        event.source.startsWith(PLAYBACK_SOURCE_PREFIX)
      )
        return;
      const nextEvent = {
        ...event,
        timeMs: performance.now() - recordingStartedAt.current,
      };
      publishEvents([...eventsRef.current, nextEvent]);
    },
    [publishEvents],
  );

  const recordNoteOn = useCallback(
    (midiNote: number, source: string, velocity = 0.8) => {
      record({ type: "note-on", midiNote, source, velocity });
      if (recordingRef.current && !source.startsWith(PLAYBACK_SOURCE_PREFIX)) {
        activeRecordingNotes.current.set(`${source}:${midiNote}`, {
          midiNote,
          source,
        });
      }
    },
    [record],
  );

  const recordNoteOff = useCallback(
    (midiNote: number, source: string) => {
      record({ type: "note-off", midiNote, source });
      activeRecordingNotes.current.delete(`${source}:${midiNote}`);
    },
    [record],
  );

  const stopPlayback = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];

    const callbacks = playbackCallbacks.current;
    if (callbacks) {
      for (const activeNote of activePlaybackNotes.current.values()) {
        callbacks.onNoteOff(activeNote.midiNote, activeNote.source);
      }
    }
    activePlaybackNotes.current.clear();
    setIsPlaying(false);
  }, []);

  const startRecording = useCallback(() => {
    stopPlayback();
    publishEvents([]);
    activeRecordingNotes.current.clear();
    recordingStartedAt.current = performance.now();
    recordingRef.current = true;
    setIsRecording(true);
  }, [publishEvents, stopPlayback]);

  const stopRecording = useCallback(() => {
    if (recordingRef.current && activeRecordingNotes.current.size > 0) {
      const stopTime = performance.now() - recordingStartedAt.current;
      const closingEvents = [...activeRecordingNotes.current.values()].map(
        (note) => ({
          type: "note-off" as const,
          midiNote: note.midiNote,
          source: note.source,
          timeMs: stopTime,
        }),
      );
      publishEvents([...eventsRef.current, ...closingEvents]);
      activeRecordingNotes.current.clear();
    }
    recordingRef.current = false;
    setIsRecording(false);
  }, [publishEvents]);

  const playRecording = useCallback(
    (callbacks: PlaybackCallbacks) => {
      if (eventsRef.current.length === 0) return;
      stopPlayback();
      recordingRef.current = false;
      setIsRecording(false);
      playbackCallbacks.current = callbacks;
      setIsPlaying(true);

      const sortedEvents = [...eventsRef.current].sort(
        (a, b) => a.timeMs - b.timeMs,
      );
      sortedEvents.forEach((event, index) => {
        const timer = window.setTimeout(() => {
          const source = `${PLAYBACK_SOURCE_PREFIX}${event.source}:${event.midiNote}`;
          const key = `${event.source}:${event.midiNote}`;
          if (event.type === "note-on") {
            activePlaybackNotes.current.set(key, {
              midiNote: event.midiNote,
              source,
            });
            callbacks.onNoteOn(event.midiNote, source, event.velocity);
          } else {
            const activeNote = activePlaybackNotes.current.get(key);
            if (activeNote) {
              callbacks.onNoteOff(activeNote.midiNote, activeNote.source);
              activePlaybackNotes.current.delete(key);
            }
          }

          if (index === sortedEvents.length - 1) setIsPlaying(false);
        }, event.timeMs);
        timersRef.current.push(timer);
      });
    },
    [stopPlayback],
  );

  const clearRecording = useCallback(() => {
    stopPlayback();
    stopRecording();
    publishEvents([]);
    activeRecordingNotes.current.clear();
  }, [publishEvents, stopPlayback, stopRecording]);

  const downloadRecording = useCallback(() => {
    if (eventsRef.current.length === 0) return;
    const file = new Blob(
      [
        JSON.stringify(
          { format: "keyflow-performance-v1", events: eventsRef.current },
          null,
          2,
        ),
      ],
      {
        type: "application/json",
      },
    );
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "keyflow-performance.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }, []);

  useEffect(
    () => () => {
      recordingRef.current = false;
      timersRef.current.forEach(window.clearTimeout);
      const callbacks = playbackCallbacks.current;
      if (callbacks) {
        for (const activeNote of activePlaybackNotes.current.values()) {
          callbacks.onNoteOff(activeNote.midiNote, activeNote.source);
        }
      }
      activePlaybackNotes.current.clear();
    },
    [],
  );

  return {
    events,
    isRecording,
    isPlaying,
    durationMs,
    recordNoteOn,
    recordNoteOff,
    startRecording,
    stopRecording,
    playRecording,
    stopPlayback,
    clearRecording,
    downloadRecording,
  };
}

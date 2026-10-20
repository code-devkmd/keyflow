import { useCallback, useEffect, useRef, useState } from "react";

type MidiAccessLike = MIDIAccess;

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: () => Promise<MIDIAccess>;
};

interface MidiInputOptions {
  onNoteOn: (midiNote: number, source: string, velocity?: number) => void;
  onNoteOff: (midiNote: number, source: string) => void;
  onPedal: (isDown: boolean, source?: string) => void;
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  state: string;
}

/** Web MIDI input bridge. It deliberately has no dependency on React UI components. */
export function useMidiInput(options: MidiInputOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const accessRef = useRef<MidiAccessLike | null>(null);
  const activeNotesRef = useRef(new Map<string, Set<number>>());
  const activePedalsRef = useRef(new Set<string>());
  const [devices, setDevices] = useState<MidiDeviceInfo[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const releaseDeviceNotes = useCallback((deviceId: string) => {
    const activeNotes = activeNotesRef.current.get(deviceId);
    if (!activeNotes) return;

    for (const midiNote of activeNotes) {
      optionsRef.current.onNoteOff(midiNote, `midi:${deviceId}:${midiNote}`);
    }
    activeNotesRef.current.delete(deviceId);
  }, []);

  const releaseAllMidiNotes = useCallback(() => {
    for (const deviceId of activeNotesRef.current.keys())
      releaseDeviceNotes(deviceId);
    for (const deviceId of activePedalsRef.current)
      optionsRef.current.onPedal(false, `midi:${deviceId}`);
    activePedalsRef.current.clear();
  }, [releaseDeviceNotes]);

  const refreshDevices = useCallback(() => {
    const access = accessRef.current;
    if (!access) return;

    const connectedInputs = [...access.inputs.values()].filter(
      (input) => input.state !== "disconnected",
    );
    const connectedIds = new Set(connectedInputs.map((input) => input.id));
    const trackedDeviceIds = new Set([
      ...activeNotesRef.current.keys(),
      ...activePedalsRef.current,
    ]);
    for (const deviceId of trackedDeviceIds) {
      if (!connectedIds.has(deviceId)) {
        releaseDeviceNotes(deviceId);
        activePedalsRef.current.delete(deviceId);
        optionsRef.current.onPedal(false, `midi:${deviceId}`);
      }
    }

    const availableDevices = connectedInputs.map((input) => ({
      id: input.id,
      name: input.name?.trim() || "MIDI keyboard",
      state: input.state ?? "connected",
    }));
    setDevices(availableDevices);
    setIsConnected(availableDevices.length > 0);

    for (const input of connectedInputs) {
      input.onmidimessage = (event) => {
        const messageData = event.data;
        if (!messageData || messageData.length < 2) return;

        const statusByte = messageData[0];
        const noteNumber = messageData[1];
        const rawVelocity = messageData[2];
        if (statusByte === undefined || noteNumber === undefined) return;

        const command = statusByte & 0xf0;
        const source = `midi:${input.id}:${noteNumber}`;
        const velocity = (rawVelocity ?? 0) / 127;

        if (command === 0x90 && velocity > 0) {
          let activeNotes = activeNotesRef.current.get(input.id);
          if (!activeNotes) {
            activeNotes = new Set<number>();
            activeNotesRef.current.set(input.id, activeNotes);
          }
          activeNotes.add(noteNumber);
          optionsRef.current.onNoteOn(noteNumber, source, velocity);
        } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
          activeNotesRef.current.get(input.id)?.delete(noteNumber);
          optionsRef.current.onNoteOff(noteNumber, source);
        } else if (command === 0xb0 && noteNumber === 64) {
          const isPedalDown = velocity >= 64 / 127;
          if (isPedalDown) activePedalsRef.current.add(input.id);
          else activePedalsRef.current.delete(input.id);
          optionsRef.current.onPedal(isPedalDown, `midi:${input.id}`);
        }
      };
    }
  }, [releaseDeviceNotes]);

  const connect = useCallback(async () => {
    const midiNavigator = navigator as NavigatorWithMidi;
    if (!midiNavigator.requestMIDIAccess) {
      setIsSupported(false);
      setError(
        "Web MIDI is not supported in this browser. Try a recent version of Chrome or Edge.",
      );
      return;
    }

    setError(null);
    setIsSupported(true);
    try {
      const access = await midiNavigator.requestMIDIAccess();
      accessRef.current = access;
      access.onstatechange = refreshDevices;
      refreshDevices();
    } catch (connectionError) {
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Could not access your MIDI keyboard.",
      );
    }
  }, [refreshDevices]);

  const disconnect = useCallback(() => {
    const access = accessRef.current;
    if (access) {
      access.onstatechange = null;
      for (const input of access.inputs.values()) input.onmidimessage = null;
    }
    releaseAllMidiNotes();
    accessRef.current = null;
    setDevices([]);
    setIsConnected(false);
    setError(null);
  }, [releaseAllMidiNotes]);

  useEffect(() => {
    setIsSupported(
      typeof (navigator as NavigatorWithMidi).requestMIDIAccess === "function",
    );
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { devices, isSupported, isConnected, error, connect, disconnect };
}

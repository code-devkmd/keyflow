import type { MidiDeviceInfo } from "@/features/midi/useMidiInput";

interface MidiInputPanelProps {
  devices: MidiDeviceInfo[];
  isSupported: boolean;
  isConnected: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  compact?: boolean;
}

export function MidiInputPanel({
  devices,
  isSupported,
  isConnected,
  error,
  onConnect,
  onDisconnect,
  compact = false,
}: MidiInputPanelProps) {
  return (
    <section
      className={`utility-panel midi-panel ${compact ? "utility-panel-compact" : ""}`}
      aria-labelledby="midi-input-title"
    >
      <div className="utility-panel-heading">
        <div>
          <div className="eyebrow">HARDWARE INPUT</div>
          <h2 id="midi-input-title">MIDI keyboard</h2>
          <p>
            Connect a USB or Bluetooth MIDI controller and play with real piano
            keys.
          </p>
        </div>
        <span
          className={`utility-status-dot ${isConnected ? "utility-status-ready" : ""}`}
          aria-label={isConnected ? "MIDI connected" : "MIDI disconnected"}
        />
      </div>

      <div className="utility-panel-actions">
        {isConnected ? (
          <button
            type="button"
            className="utility-secondary-button"
            onClick={onDisconnect}
          >
            Disconnect MIDI
          </button>
        ) : (
          <button
            type="button"
            className="utility-primary-button"
            onClick={onConnect}
            disabled={!isSupported}
          >
            {isSupported
              ? "Connect MIDI keyboard"
              : "MIDI unavailable in this browser"}
          </button>
        )}
        <span className="utility-muted-text">
          {isConnected
            ? `${devices.length} device${devices.length === 1 ? "" : "s"} detected`
            : "Requires browser permission and HTTPS or localhost"}
        </span>
      </div>

      {devices.length > 0 && (
        <ul className="midi-device-list" aria-label="Connected MIDI devices">
          {devices.map((device) => (
            <li key={device.id}>
              <span className="midi-device-indicator" />
              <span>{device.name}</span>
              <small>{device.state}</small>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="utility-error-message">
          {error}
        </p>
      )}
      {!isSupported && (
        <p className="utility-muted-text">
          Web MIDI support varies by browser. Recent desktop Chrome and Edge are
          recommended.
        </p>
      )}
    </section>
  );
}

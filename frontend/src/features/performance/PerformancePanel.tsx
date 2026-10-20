import { formatDuration } from "@/shared/utils/formatDuration";

interface PerformancePanelProps {
  eventCount: number;
  durationMs: number;
  isRecording: boolean;
  isPlaying: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlay: () => void;
  onStopPlayback: () => void;
  onClear: () => void;
  onDownload: () => void;
}

export function PerformancePanel({
  eventCount,
  durationMs,
  isRecording,
  isPlaying,
  onStartRecording,
  onStopRecording,
  onPlay,
  onStopPlayback,
  onClear,
  onDownload,
}: PerformancePanelProps) {
  return (
    <section
      className="utility-panel performance-panel"
      aria-labelledby="performance-title"
    >
      <div className="utility-panel-heading">
        <div>
          <div className="eyebrow">CAPTURE YOUR IDEAS</div>
          <h2 id="performance-title">Performance recorder</h2>
          <p>
            Record notes from the computer keyboard, virtual piano, or connected
            MIDI controller.
          </p>
        </div>
        <span
          className={`recording-indicator ${isRecording ? "recording-indicator-active" : ""}`}
          aria-label={isRecording ? "Recording" : "Not recording"}
        />
      </div>

      <div className="performance-summary" aria-live="polite">
        <span>{eventCount} note events</span>
        <span>{formatDuration(durationMs)}</span>
        <span>
          {isRecording ? "Recording now" : isPlaying ? "Playing back" : "Ready"}
        </span>
      </div>

      <div className="utility-panel-actions performance-actions">
        {isRecording ? (
          <button
            type="button"
            className="utility-danger-button"
            onClick={onStopRecording}
          >
            Stop recording
          </button>
        ) : (
          <button
            type="button"
            className="utility-primary-button"
            onClick={onStartRecording}
            disabled={isPlaying}
          >
            ● Record
          </button>
        )}
        {isPlaying ? (
          <button
            type="button"
            className="utility-secondary-button"
            onClick={onStopPlayback}
          >
            Stop playback
          </button>
        ) : (
          <button
            type="button"
            className="utility-secondary-button"
            onClick={onPlay}
            disabled={eventCount === 0 || isRecording}
          >
            ▶ Play
          </button>
        )}
        <button
          type="button"
          className="utility-secondary-button"
          onClick={onDownload}
          disabled={eventCount === 0 || isRecording}
        >
          Export JSON
        </button>
        <button
          type="button"
          className="utility-text-button"
          onClick={onClear}
          disabled={eventCount === 0 && !isRecording && !isPlaying}
        >
          Clear
        </button>
      </div>
      <p className="utility-muted-text">
        Recordings are stored in this tab's memory until you export them or
        close the page.
      </p>
    </section>
  );
}

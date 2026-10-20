import type { InstrumentMode } from "@/audio/audioEngine";

interface AudioControlsProps {
  volume: number;
  onVolume: (value: number) => void;
  reverbAmount: number;
  onReverbAmount: (value: number) => void;
  releaseDuration: number;
  onReleaseDuration: (value: number) => void;
  sustain: boolean;
  onSustain: (isEnabled: boolean) => void;
  octaves: number;
  onOctaves: (count: number) => void;
  shift: number;
  onShift: (octaves: number) => void;
  instrumentMode: InstrumentMode;
  onInstrumentMode: (mode: InstrumentMode) => void;
  isChangingInstrument: boolean;
  instrumentError: string | null;
}

const stepperClassName = "control-stepper";

export function AudioControls({
  volume,
  onVolume,
  reverbAmount,
  onReverbAmount,
  releaseDuration,
  onReleaseDuration,
  sustain,
  onSustain,
  octaves,
  onOctaves,
  shift,
  onShift,
  instrumentMode,
  onInstrumentMode,
  isChangingInstrument,
  instrumentError,
}: AudioControlsProps) {
  return (
    <div className="control-deck">
      <div className="control-group instrument-mode-group">
        <span className="control-title">PIANO SOUND</span>
        <div
          className="instrument-mode-options"
          role="group"
          aria-label="Piano sound"
        >
          <button
            type="button"
            className={
              instrumentMode === "synth"
                ? "instrument-mode-button selected"
                : "instrument-mode-button"
            }
            onClick={() => onInstrumentMode("synth")}
            disabled={isChangingInstrument}
          >
            Synth
          </button>
          <button
            type="button"
            className={
              instrumentMode === "sampled"
                ? "instrument-mode-button selected"
                : "instrument-mode-button"
            }
            onClick={() => onInstrumentMode("sampled")}
            disabled={isChangingInstrument}
          >
            {isChangingInstrument ? "Loading…" : "Sampled piano"}
          </button>
        </div>
        {instrumentError && (
          <small className="instrument-error" role="alert">
            {instrumentError}
          </small>
        )}
      </div>

      <label className="control-group volume-group">
        <span className="control-title">MASTER VOLUME</span>
        <span className="volume-row">
          <span className="volume-symbol" aria-hidden="true">
            ◖
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => onVolume(Number(event.target.value))}
            className="volume-slider"
            aria-label="Master volume"
          />
          <span className="volume-value">{Math.round(volume * 100)}%</span>
        </span>
      </label>

      <label className="control-group reverb-group">
        <span className="control-title">ROOM REVERB</span>
        <span className="volume-row">
          <input
            type="range"
            min={0}
            max={0.6}
            step={0.01}
            value={reverbAmount}
            onChange={(event) => onReverbAmount(Number(event.target.value))}
            className="volume-slider"
            aria-label="Room reverb amount"
          />
          <span className="volume-value">
            {Math.round(reverbAmount * 100)}%
          </span>
        </span>
        <small className="fade-caption">
          Adds a little room around each note
        </small>
      </label>

      <label className="control-group fade-group">
        <span className="control-title">NOTE FADE</span>
        <span className="volume-row">
          <input
            type="range"
            min={0.2}
            max={4}
            step={0.1}
            value={releaseDuration}
            onChange={(event) => onReleaseDuration(Number(event.target.value))}
            className="volume-slider"
            aria-label="Note fade duration"
          />
          <span className="volume-value">{releaseDuration.toFixed(1)}s</span>
        </span>
        <small className="fade-caption">Longer = softer, longer ring</small>
      </label>

      <div className="control-group">
        <span className="control-title">KEYBOARD RANGE</span>
        <div className="control-row">
          <button
            type="button"
            className={stepperClassName}
            onClick={() => onOctaves(octaves - 1)}
            disabled={octaves <= 2}
            aria-label="Show fewer octaves"
          >
            −
          </button>
          <span className="control-value">
            {octaves} <small>oct.</small>
          </span>
          <button
            type="button"
            className={stepperClassName}
            onClick={() => onOctaves(octaves + 1)}
            disabled={octaves >= 7}
            aria-label="Show more octaves"
          >
            +
          </button>
        </div>
      </div>

      <div className="control-group">
        <span className="control-title">PLAYING OCTAVE</span>
        <div className="control-row">
          <button
            type="button"
            className={stepperClassName}
            onClick={() => onShift(shift - 1)}
            disabled={shift <= -3}
            aria-label="Shift computer keys down an octave"
          >
            −
          </button>
          <span className="control-value">
            {shift > 0 ? `+${shift}` : shift} <small>oct. shift</small>
          </span>
          <button
            type="button"
            className={stepperClassName}
            onClick={() => onShift(shift + 1)}
            disabled={shift >= 3}
            aria-label="Shift computer keys up an octave"
          >
            +
          </button>
        </div>
      </div>

      <label className={`sustain-control ${sustain ? "sustain-on" : ""}`}>
        <input
          type="checkbox"
          checked={sustain}
          onChange={(event) => onSustain(event.target.checked)}
        />
        <span className="pedal-icon" aria-hidden="true">
          ⌁
        </span>
        <span>
          <strong>Sustain</strong>
          <small>{sustain ? "Pedal engaged" : "Let notes ring"}</small>
        </span>
      </label>
    </div>
  );
}

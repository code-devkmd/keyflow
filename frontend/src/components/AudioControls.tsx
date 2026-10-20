interface Props {
  volume: number;
  onVolume: (v: number) => void;
  releaseDuration: number;
  onReleaseDuration: (v: number) => void;
  sustain: boolean;
  onSustain: (v: boolean) => void;
  octaves: number;
  onOctaves: (n: number) => void;
  shift: number;
  onShift: (n: number) => void;
}

const btn = "control-stepper";

export function AudioControls({
  volume,
  onVolume,
  releaseDuration,
  onReleaseDuration,
  sustain,
  onSustain,
  octaves,
  onOctaves,
  shift,
  onShift,
}: Props) {
  return (
    <div className="control-deck">
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
            onChange={(e) => onVolume(+e.target.value)}
            className="volume-slider"
            aria-label="Master volume"
          />
          <span className="volume-value">{Math.round(volume * 100)}%</span>
        </span>
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
            onChange={(e) => onReleaseDuration(+e.target.value)}
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
            className={btn}
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
            className={btn}
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
            className={btn}
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
            className={btn}
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
          onChange={(e) => onSustain(e.target.checked)}
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

import { useEffect, useState } from "react";
import { codeLabel } from "../utils/keyboardMapping";
import { midiToNoteName, noteNameToMidi } from "../utils/musicTheory";

export interface ChordShortcut {
  code: string;
  notes: number[];
}

interface Props {
  shortcuts: ChordShortcut[];
  onChange: (shortcuts: ChordShortcut[]) => void;
}

const RESERVED = new Set([
  "Space",
  "Escape",
  "ArrowLeft",
  "ArrowRight",
  "Tab",
  "Enter",
  "Backspace",
  "Delete",
]);

export function ChordShortcuts({ shortcuts, onChange }: Props) {
  const [capturing, setCapturing] = useState(false);
  const [code, setCode] = useState("");
  const [notesText, setNotesText] = useState("C4, E4, G4");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!capturing) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (
        RESERVED.has(event.code) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        setError(
          "Choose a letter, number, or punctuation key (not a control key).",
        );
        return;
      }
      setCode(event.code);
      setCapturing(false);
      setError("");
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [capturing]);

  const addShortcut = () => {
    setError("");
    if (!code) {
      setError("Choose a shortcut key first.");
      return;
    }
    try {
      const notes = notesText
        .split(/[ ,;]+/)
        .filter(Boolean)
        .map(noteNameToMidi);
      if (!notes.length) {
        setError("Enter at least one note, e.g. C4, E4, G4.");
        return;
      }
      const remaining = shortcuts.filter(
        (s) => s.code !== code && s.code !== editingCode,
      );
      onChange([...remaining, { code, notes: [...new Set(notes)] }]);
      setCode("");
      setEditingCode(null);
      setNotesText("C4, E4, G4");
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message}. Use note names like F2, C3, F3.`
          : "Check the note names.",
      );
    }
  };

  return (
    <section
      className="chord-shortcuts-panel"
      aria-labelledby="chord-shortcuts-title"
    >
      <div className="chord-shortcuts-heading">
        <div>
          <div className="eyebrow">PERSONAL SHORTCUTS</div>
          <h2 id="chord-shortcuts-title">One key, many notes</h2>
          <p>
            Assign a single computer key to trigger a whole chord or any group
            of notes together.
          </p>
        </div>
        <span className="chord-shortcuts-icon" aria-hidden="true">
          ♫
        </span>
      </div>
      <div className="chord-shortcut-form">
        <div className="shortcut-key-picker">
          <label>Shortcut key</label>
          <button
            type="button"
            className={
              capturing ? "capture-key-button capturing" : "capture-key-button"
            }
            onClick={() => {
              setCapturing(true);
              setError("");
            }}
          >
            {capturing
              ? "Press any key…"
              : code
                ? codeLabel(code)
                : "Choose key"}
          </button>
        </div>
        <div className="shortcut-notes-field">
          <label htmlFor="shortcut-notes">Notes to play together</label>
          <input
            id="shortcut-notes"
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="F2, C3, F3"
            spellCheck={false}
          />
        </div>
        <button
          type="button"
          className="add-shortcut-button"
          onClick={addShortcut}
        >
          {editingCode || shortcuts.some((s) => s.code === code)
            ? "Update shortcut"
            : "Save shortcut"}
        </button>
      </div>
      <p className="shortcut-note-hint">
        Enter notes separated by commas, like <code>F2, C3, F3</code> or{" "}
        <code>A4, E5</code>. Notes use scientific pitch names. Your shortcuts
        are saved in this browser.
      </p>
      {error && (
        <p role="alert" className="shortcut-form-error">
          {error}
        </p>
      )}
      {shortcuts.length > 0 ? (
        <ul className="chord-shortcut-list">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.code}>
              <kbd>{codeLabel(shortcut.code)}</kbd>
              <span className="shortcut-note-list">
                {shortcut.notes.map(midiToNoteName).join(" · ")}
              </span>
              <button
                type="button"
                aria-label={`Edit shortcut ${codeLabel(shortcut.code)}`}
                onClick={() => {
                  setCode(shortcut.code);
                  setEditingCode(shortcut.code);
                  setNotesText(shortcut.notes.map(midiToNoteName).join(", "));
                  setError("");
                }}
              >
                Edit
              </button>
              <button
                type="button"
                aria-label={`Delete shortcut ${codeLabel(shortcut.code)}`}
                onClick={() => {
                  onChange(shortcuts.filter((s) => s.code !== shortcut.code));
                  if (editingCode === shortcut.code) {
                    setEditingCode(null);
                    setCode("");
                  }
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="shortcut-empty-state">
          No custom shortcuts yet. Try assigning <strong>F2, C3, F3</strong> to
          one comfortable key.
        </div>
      )}
    </section>
  );
}

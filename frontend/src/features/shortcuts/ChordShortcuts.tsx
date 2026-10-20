import { useEffect, useState } from "react";
import { codeLabel } from "@/shared/utils/keyboardMapping";
import { midiToNoteName, noteNameToMidi } from "@/shared/utils/musicTheory";

export interface ChordShortcut {
  code: string;
  notes: number[];
}

export interface ShortcutBank {
  id: string;
  name: string;
  shortcuts: ChordShortcut[];
}

interface ChordShortcutsProps {
  shortcuts: ChordShortcut[];
  banks: Pick<ShortcutBank, "id" | "name">[];
  activeBankId: string;
  onSelectBank: (bankId: string) => void;
  onCreateBank: () => void;
  onRenameBank: () => void;
  onChange: (shortcuts: ChordShortcut[]) => void;
}

const RESERVED_KEYS = new Set([
  "Space",
  "Escape",
  "ArrowLeft",
  "ArrowRight",
  "Tab",
  "Enter",
  "Backspace",
  "Delete",
]);

export function ChordShortcuts({
  shortcuts,
  banks,
  activeBankId,
  onSelectBank,
  onCreateBank,
  onRenameBank,
  onChange,
}: ChordShortcutsProps) {
  const [isCapturingKey, setIsCapturingKey] = useState(false);
  const [shortcutCode, setShortcutCode] = useState("");
  const [notesText, setNotesText] = useState("C4, E4, G4");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isCapturingKey) return;

    const captureKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (
        RESERVED_KEYS.has(event.code) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        setError(
          "Choose a letter, number, or punctuation key (not a control key).",
        );
        return;
      }

      setShortcutCode(event.code);
      setIsCapturingKey(false);
      setError("");
    };

    window.addEventListener("keydown", captureKey, true);
    return () => window.removeEventListener("keydown", captureKey, true);
  }, [isCapturingKey]);

  const selectBank = (bankId: string) => {
    onSelectBank(bankId);
    setShortcutCode("");
    setEditingCode(null);
    setNotesText("C4, E4, G4");
    setIsCapturingKey(false);
    setError("");
  };

  const saveShortcut = () => {
    setError("");

    if (!shortcutCode) {
      setError("Choose a shortcut key first.");
      return;
    }

    try {
      const notes: number[] = notesText
        .split(/[ ,;]+/)
        .filter(Boolean)
        .map((noteName) => noteNameToMidi(noteName));

      if (notes.length === 0) {
        setError("Enter at least one note, e.g. C4, E4, G4.");
        return;
      }

      const remainingShortcuts = shortcuts.filter(
        (shortcut) =>
          shortcut.code !== shortcutCode && shortcut.code !== editingCode,
      );
      onChange([
        ...remainingShortcuts,
        { code: shortcutCode, notes: [...new Set(notes)] },
      ]);
      setShortcutCode("");
      setEditingCode(null);
      setNotesText("C4, E4, G4");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? `${saveError.message}. Use note names like F2, C3, F3.`
          : "Check the note names.",
      );
    }
  };

  const editShortcut = (shortcut: ChordShortcut) => {
    setShortcutCode(shortcut.code);
    setEditingCode(shortcut.code);
    setNotesText(shortcut.notes.map(midiToNoteName).join(", "));
    setError("");
  };

  const removeShortcut = (shortcutCodeToRemove: string) => {
    onChange(
      shortcuts.filter((shortcut) => shortcut.code !== shortcutCodeToRemove),
    );
    if (editingCode === shortcutCodeToRemove) {
      setEditingCode(null);
      setShortcutCode("");
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
        <div className="shortcut-bank-controls">
          <label>
            <span className="sr-only">Shortcut bank</span>
            <select
              value={activeBankId}
              onChange={(event) => selectBank(event.target.value)}
              aria-label="Shortcut bank"
            >
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="shortcut-bank-add"
            onClick={onRenameBank}
          >
            Rename
          </button>
          <button
            type="button"
            className="shortcut-bank-add"
            onClick={onCreateBank}
          >
            + New bank
          </button>
        </div>
      </div>

      <div className="chord-shortcut-form">
        <div className="shortcut-key-picker">
          <label>Shortcut key</label>
          <button
            type="button"
            className={
              isCapturingKey
                ? "capture-key-button capturing"
                : "capture-key-button"
            }
            onClick={() => {
              setIsCapturingKey(true);
              setError("");
            }}
          >
            {isCapturingKey
              ? "Press any key…"
              : shortcutCode
                ? codeLabel(shortcutCode)
                : "Choose key"}
          </button>
        </div>

        <div className="shortcut-notes-field">
          <label htmlFor="shortcut-notes">Notes to play together</label>
          <input
            id="shortcut-notes"
            value={notesText}
            onChange={(event) => setNotesText(event.target.value)}
            placeholder="F2, C3, F3"
            spellCheck={false}
          />
        </div>

        <button
          type="button"
          className="add-shortcut-button"
          onClick={saveShortcut}
        >
          {editingCode ||
          shortcuts.some((shortcut) => shortcut.code === shortcutCode)
            ? "Update shortcut"
            : "Save shortcut"}
        </button>
      </div>

      <p className="shortcut-note-hint">
        Enter notes separated by commas, like <code>F2, C3, F3</code> or{" "}
        <code>A4, E5</code>. Notes use scientific pitch names. Each bank is
        saved in this browser. Switch banks for different songs or performances.
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
                onClick={() => editShortcut(shortcut)}
              >
                Edit
              </button>
              <button
                type="button"
                aria-label={`Delete shortcut ${codeLabel(shortcut.code)}`}
                onClick={() => removeShortcut(shortcut.code)}
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

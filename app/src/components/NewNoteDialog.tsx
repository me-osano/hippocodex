import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createNote, normalizeNoteName, noteFileName } from "../lib/notes";
import type { CreatedNoteResult, NoteFormat } from "../lib/notes";
import { isTauriRuntime } from "../platform/files";
import {
  IconClose,
  IconFile,
  IconFolder,
  IconHash,
  IconInfo,
  IconPlus,
} from "./Icons";

interface NewNoteDialogProps {
  libraryPath: string | null;
  onCreated: (result: CreatedNoteResult) => void;
  onClose: () => void;
}

const FORMATS: Array<{ id: NoteFormat; label: string; detail: string; icon: typeof IconFile }> = [
  { id: "md", label: "Markdown", detail: "Headings, links, and study notes (.md)", icon: IconHash },
  { id: "txt", label: "Plain text", detail: "A simple note with no formatting (.txt)", icon: IconFile },
];

export function NewNoteDialog({ libraryPath, onCreated, onClose }: NewNoteDialogProps) {
  const [name, setName] = useState("Untitled note");
  const [format, setFormat] = useState<NoteFormat>("md");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const desktop = isTauriRuntime();
  const needsLibrary = desktop && !libraryPath;
  const normalized = normalizeNoteName(name);
  const fileName = normalized.value ? noteFileName(normalized.value, format) : "note";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || needsLibrary) return;
    const checked = normalizeNoteName(name);
    if (checked.error) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCreated(await createNote(name, format));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The note could not be created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <form
        className="modal note-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-note-title"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              <IconPlus size={14} /> New note
            </span>
            <h2 id="new-note-title">Start a note.</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close new note"
          >
            <IconClose size={18} />
          </button>
        </div>

        <label className="wizard-field" htmlFor="note-name">
          <span>Note name</span>
          <input
            ref={nameRef}
            id="note-name"
            className="note-name-input"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            spellCheck={false}
            autoComplete="off"
            placeholder="Lecture notes"
            maxLength={120}
          />
        </label>

        <div className="wizard-modes note-formats" role="radiogroup" aria-label="Note format">
          {FORMATS.map(({ id, label, detail, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={format === id}
              className={`wizard-mode ${format === id ? "is-selected" : ""}`}
              onClick={() => setFormat(id)}
              disabled={busy}
            >
              <Icon size={19} />
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </button>
          ))}
        </div>

        {needsLibrary ? (
          <p className="wizard-error" role="alert">
            Choose a Library folder in Settings before creating notes.
          </p>
        ) : desktop && libraryPath ? (
          <div className="wizard-path-preview" title={`${libraryPath}/${fileName}`}>
            <IconFolder size={16} /> {libraryPath}/{fileName}
          </div>
        ) : (
          <div className="wizard-path-preview">
            <IconInfo size={16} /> Browser preview: this note stays in the current session.
          </div>
        )}

        {error && <p className="wizard-error" role="alert">{error}</p>}

        <div className="wizard-footer">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || needsLibrary}>
            {busy ? "Creating…" : "Create note"}
          </button>
        </div>
      </form>
    </div>
  );
}

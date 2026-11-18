import { useCallback, useEffect, useRef, useState } from "react";
import type { OpenDocument } from "../types";
import { decodeUtf8 } from "../lib/text";

export interface NoteEditorState {
  draft: string;
  dirty: boolean;
  saving: boolean;
  update: (value: string) => void;
  save: () => Promise<boolean>;
  revert: () => void;
}

/**
 * Local draft state for an editable Markdown or text note. Saving is delegated
 * to the app shell so it can apply the right desktop/browser write policy; the
 * draft only marks itself clean when that save succeeds.
 */
export function useNoteEditor(
  doc: OpenDocument,
  onSave: ((text: string) => Promise<boolean>) | undefined,
  enabled: boolean,
): NoteEditorState {
  const [draft, setDraft] = useState(() => decodeUtf8(doc.bytes));
  const [saved, setSaved] = useState(() => decodeUtf8(doc.bytes));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    const text = decodeUtf8(doc.bytes);
    setDraft(text);
    setSaved(text);
  }, [doc.id, doc.bytes]);

  const save = useCallback(async () => {
    if (!onSave || savingRef.current) return false;
    if (draft === saved) return true;
    savingRef.current = true;
    setSaving(true);
    try {
      const ok = await onSave(draft);
      if (ok) setSaved(draft);
      return ok;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [draft, onSave, saved]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopPropagation();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, save]);

  const revert = useCallback(() => setDraft(saved), [saved]);

  return { draft, dirty: draft !== saved, saving, update: setDraft, save, revert };
}

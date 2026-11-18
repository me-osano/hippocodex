import type { FileSource, OpenDocument } from "../types";
import { isTauriRuntime } from "../platform/files";
import { createVaultNote, isVaultPath } from "./vault";

export type NoteFormat = "md" | "txt";

export interface NoteNameResult {
  value: string;
  error?: string;
}

const MAX_NAME_LENGTH = 80;
const KNOWN_EXTENSIONS = [".md", ".markdown", ".txt", ".text"];

function hasForbiddenCharacter(value: string): boolean {
  return (
    /[<>:"/\\|?*]/.test(value) ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32)
  );
}

/**
 * Turn a typed name into a plain, portable file stem. Notes live directly in
 * the Library root, so separators, reserved characters, and hidden names are
 * refused here and again in Rust before anything is written.
 */
export function normalizeNoteName(input: string): NoteNameResult {
  let value = input.trim();
  for (const extension of KNOWN_EXTENSIONS) {
    if (value.toLowerCase().endsWith(extension)) {
      value = value.slice(0, -extension.length).trim();
      break;
    }
  }
  if (!value) return { value: "", error: "Give the note a name." };
  if (hasForbiddenCharacter(value)) {
    return {
      value,
      error: "Use letters, numbers, spaces, dashes, or underscores — no path symbols.",
    };
  }
  if (value === "." || value === ".." || value.startsWith(".")) {
    return { value, error: "Note names cannot start with a dot." };
  }
  if (value.length > MAX_NAME_LENGTH) {
    return { value, error: `Keep the name under ${MAX_NAME_LENGTH} characters.` };
  }
  return { value };
}

export function noteFileName(name: string, format: NoteFormat): string {
  return `${name}.${format}`;
}

export function noteTemplate(name: string, format: NoteFormat): string {
  return format === "md" ? `# ${name}\n\n` : `${name}\n\n`;
}

export function noteExtension(name: string): string | null {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : null;
}

/**
 * Markdown and text notes are editable. Disk-backed notes must live inside the
 * configured Library; browser-preview notes without a path are session-only.
 */
export function isEditableNote(
  doc: Pick<OpenDocument, "name" | "path" | "kind">,
  vaultPath: string | null,
): boolean {
  if (doc.kind !== "markdown" && doc.kind !== "text") return false;
  if (!["md", "txt"].includes(noteExtension(doc.name) ?? "")) return false;
  if (!doc.path) return true;
  return isVaultPath(doc.path, vaultPath);
}

function noteMediaType(format: NoteFormat): string {
  return format === "md" ? "text/markdown" : "text/plain";
}

export interface CreatedNoteResult {
  source: FileSource;
  /** False for browser-preview notes, which exist only for this session. */
  saved: boolean;
}

/**
 * Create the note and return a source ready for the normal open pipeline.
 * Desktop writes are confined to the configured Library by the Rust command;
 * the browser preview keeps the bytes in memory instead.
 */
export async function createNote(name: string, format: NoteFormat): Promise<CreatedNoteResult> {
  const normalized = normalizeNoteName(name);
  if (normalized.error) throw new Error(normalized.error);
  if (format !== "md" && format !== "txt") throw new Error("Choose Markdown or plain text.");

  const fileName = noteFileName(normalized.value, format);
  if (isTauriRuntime()) {
    const created = await createVaultNote(normalized.value, format);
    return {
      source: { kind: "path", path: created.path, name: created.name || fileName },
      saved: true,
    };
  }

  const file = new File([noteTemplate(normalized.value, format)], fileName, {
    type: noteMediaType(format),
    lastModified: Date.now(),
  });
  return { source: { kind: "file", file, name: fileName }, saved: false };
}

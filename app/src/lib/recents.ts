import type { DocumentKind, FileSource, RecentDocument } from "../types";

const KEY = "hippocodex.recents.v1";
const MAX_RECENTS = 24;
const KINDS: DocumentKind[] = [
  "pdf",
  "markdown",
  "text",
  "code",
  "image",
  "csv",
  "spreadsheet",
  "docx",
  "presentation",
];

function isRecent(value: unknown): value is RecentDocument {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<RecentDocument>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.size === "number" &&
    typeof entry.openedAt === "number" &&
    typeof entry.kind === "string" &&
    KINDS.includes(entry.kind as DocumentKind)
  );
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadRecents(): RecentDocument[] {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecent).sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function saveRecents(recents: RecentDocument[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  } catch {
    // Storage can be unavailable in private windows or when the quota is full.
  }
}

export function addRecent(recents: RecentDocument[], entry: RecentDocument): RecentDocument[] {
  const next = [entry, ...recents.filter((item) => item.id !== entry.id)].slice(0, MAX_RECENTS);
  saveRecents(next);
  return next;
}

export function removeRecent(recents: RecentDocument[], id: string): RecentDocument[] {
  const next = recents.filter((item) => item.id !== id);
  saveRecents(next);
  return next;
}

export function clearRecents(): RecentDocument[] {
  saveRecents([]);
  return [];
}

export function recentFromSource(source: FileSource, size: number, kind: DocumentKind, openedAt = Date.now()): RecentDocument {
  return {
    id: source.kind === "path" && source.path ? source.path : `session:${source.name}:${size}:${openedAt}`,
    name: source.name,
    size,
    kind,
    path: source.kind === "path" ? source.path : undefined,
    openedAt,
  };
}

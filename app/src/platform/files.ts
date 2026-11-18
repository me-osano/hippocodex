import type { FileSource } from "../types";
import { SUPPORTED_EXTENSIONS } from "../types";

/** Files opened in the browser live only for this page session. */
const sessionFiles = new Map<string, File>();

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function sessionFileKey(name: string, size: number, lastModified: number): string {
  return `session:${name}:${size}:${lastModified}`;
}

export function rememberSessionFile(file: File): string {
  const key = sessionFileKey(file.name, file.size, file.lastModified);
  sessionFiles.set(key, file);
  return key;
}

export function getSessionFile(key: string): File | undefined {
  return sessionFiles.get(key);
}

export function sourceFromPath(path: string): FileSource {
  const name = path.replace(/\\/g, "/").split("/").pop() || path;
  return { kind: "path", path, name };
}

export async function pickFiles(): Promise<FileSource[]> {
  if (isTauriRuntime()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selection = await open({
      multiple: false,
      directory: false,
      title: "Open a document",
      filters: [
        { name: "Documents", extensions: [...SUPPORTED_EXTENSIONS] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (!selection) return [];
    const paths = Array.isArray(selection) ? selection : [selection];
    return paths.filter((path): path is string => typeof path === "string").map(sourceFromPath);
  }

  return new Promise<FileSource[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`).join(",");
    input.style.display = "none";
    document.body.append(input);

    let settled = false;
    const finish = (sources: FileSource[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(sources);
    };

    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      finish(files.map((file) => ({ kind: "file", file, name: file.name })));
    });
    input.addEventListener("cancel", () => finish([]));
    window.addEventListener("focus", () => window.setTimeout(() => finish([]), 500), { once: true });
    input.click();
  });
}

export interface OpenedBytes {
  name: string;
  size: number;
  bytes: Uint8Array;
  lastModified?: number;
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) return new Uint8Array(value);
  throw new Error("The file could not be read.");
}

export async function readSource(source: FileSource): Promise<OpenedBytes> {
  if (source.kind === "file" && source.file) {
    const buffer = await source.file.arrayBuffer();
    return {
      name: source.file.name,
      size: source.file.size,
      bytes: new Uint8Array(buffer),
      lastModified: source.file.lastModified,
    };
  }

  if (!source.path) throw new Error("No file path was provided.");
  const bytes = await readPath(source.path);
  return { name: source.name, size: bytes.byteLength, bytes };
}

export async function readPath(path: string): Promise<Uint8Array> {
  if (!isTauriRuntime()) {
    throw new Error("Opening files by path is only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<ArrayBuffer | number[]>("read_file", { path });
  return toUint8Array(result);
}

export interface DropSubscription {
  unlisten: () => void;
}

/**
 * Subscribe to desktop drag-and-drop. In the browser, HTML drag events are
 * handled by the app shell instead.
 */
export async function subscribeToDesktopFileDrop(
  onOver: () => void,
  onLeave: () => void,
  onDrop: (paths: string[]) => void,
): Promise<DropSubscription | null> {
  if (!isTauriRuntime()) return null;
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
    const payload = event.payload as { type?: string; paths?: string[] };
    if (payload.type === "over") onOver();
    else if (payload.type === "leave") onLeave();
    else if (payload.type === "drop") {
      onLeave();
      if (payload.paths?.length) onDrop(payload.paths);
    }
  });
  return { unlisten };
}

export function browserFilesFromDrop(event: DragEvent): FileSource[] {
  const files = Array.from(event.dataTransfer?.files ?? []);
  return files.map((file) => ({ kind: "file", file, name: file.name }));
}

export function hasFilePayload(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

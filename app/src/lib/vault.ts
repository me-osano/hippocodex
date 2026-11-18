import type { FileSource } from "../types";
import { SUPPORTED_EXTENSIONS } from "../types";
import { basename } from "./format";
import { isTauriRuntime } from "../platform/files";

export const VAULT_PATH_KEY = "hippocodex.vaultDir";

export interface VaultInfo {
  path: string;
  name: string;
  exists: boolean;
  writable: boolean;
}

/** Result of creating a note inside the configured Library. */
export interface CreatedNote {
  /** Absolute path, ready for the existing file-opening pipeline. */
  path: string;
  name: string;
  /** Path relative to the Library root, always with `/` separators. */
  relativePath: string;
}

export type VaultEntryKind = "directory" | "file";

export interface VaultEntry {
  name: string;
  /** Path relative to the vault root, always with `/` separators. */
  path: string;
  absolutePath: string;
  kind: VaultEntryKind;
  hasChildren: boolean;
}

export function readVaultPath(): string | null {
  try {
    const value = window.localStorage.getItem(VAULT_PATH_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function persistVaultPath(path: string): void {
  try {
    window.localStorage.setItem(VAULT_PATH_KEY, path);
  } catch {
    // Storage can be unavailable in private browsing; the session still works.
  }
}

export function clearVaultPath(): void {
  try {
    window.localStorage.removeItem(VAULT_PATH_KEY);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

/** Build a FileSource from a vault tree entry without copying the bytes. */
export function vaultSource(entry: Pick<VaultEntry, "absolutePath" | "name">): FileSource {
  return { kind: "path", path: entry.absolutePath, name: entry.name };
}

export function isSupportedVaultFile(name: string): boolean {
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : undefined;
  return !!extension && (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension);
}

/** Check that an absolute file path is inside the configured Library root. */
export function isVaultPath(path: string | undefined, vaultPath: string | null): boolean {
  if (!path || !vaultPath) return false;
  const normalize = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/, "");
  let root = normalize(vaultPath);
  let target = normalize(path);
  const isWindows = /^[A-Za-z]:\//.test(root) || root.startsWith("//");
  if (isWindows) {
    root = root.toLowerCase();
    target = target.toLowerCase();
  }
  return target.startsWith(`${root}/`);
}

async function invokeVault<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error("Library folders are available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

function browserVaultInfo(path: string): VaultInfo {
  return { path, name: basename(path), exists: true, writable: false };
}

export async function fetchVaultInfo(): Promise<VaultInfo | null> {
  if (!isTauriRuntime()) {
    const path = readVaultPath();
    return path ? browserVaultInfo(path) : null;
  }
  return invokeVault<VaultInfo | null>("get_vault");
}

export async function suggestVaultPath(): Promise<string> {
  if (!isTauriRuntime()) return "~/Documents/Library";
  return invokeVault<string>("default_vault_path");
}

export async function chooseVaultFolder(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selection = await open({
    multiple: false,
    directory: true,
    title: "Choose your library folder",
  });
  return typeof selection === "string" ? selection : null;
}

export async function validateVaultPath(path: string): Promise<VaultInfo> {
  if (!isTauriRuntime()) return browserVaultInfo(path);
  return invokeVault<VaultInfo>("validate_vault", { path });
}

export async function createVaultFolder(path: string): Promise<VaultInfo> {
  if (!isTauriRuntime()) return browserVaultInfo(path);
  return invokeVault<VaultInfo>("create_vault", { path });
}

export async function configureVault(path: string): Promise<VaultInfo> {
  const info = isTauriRuntime()
    ? await invokeVault<VaultInfo>("set_vault", { path })
    : browserVaultInfo(path);
  persistVaultPath(info.path);
  return info;
}

export async function resetVault(): Promise<void> {
  if (isTauriRuntime()) await invokeVault<void>("clear_vault");
  clearVaultPath();
}

export async function listVaultEntries(path = ""): Promise<VaultEntry[]> {
  return invokeVault<VaultEntry[]>("list_vault_entries", { path });
}

/** Create a note inside the Library. The Rust command enforces confinement. */
export async function createVaultNote(name: string, format: "md" | "txt"): Promise<CreatedNote> {
  return invokeVault<CreatedNote>("create_note", { name, format });
}

/** Save edited note contents back to an existing Library file. */
export async function updateVaultNote(path: string, contents: string): Promise<void> {
  await invokeVault<void>("update_note", { path, contents });
}

/** Search file names and relative paths across the whole Library. */
export async function searchVaultFiles(query: string): Promise<VaultEntry[]> {
  return invokeVault<VaultEntry[]>("search_vault_files", { query });
}

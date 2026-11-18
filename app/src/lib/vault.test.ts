import { describe, expect, it } from "vitest";
import {
  VAULT_PATH_KEY,
  clearVaultPath,
  configureVault,
  fetchVaultInfo,
  isSupportedVaultFile,
  isVaultPath,
  listVaultEntries,
  persistVaultPath,
  readVaultPath,
  vaultSource,
} from "./vault";

describe("vault path storage", () => {
  it("persists, reads, and clears a vault path", () => {
    expect(readVaultPath()).toBeNull();
    persistVaultPath("/home/you/Library");
    expect(window.localStorage.getItem(VAULT_PATH_KEY)).toBe("/home/you/Library");
    expect(readVaultPath()).toBe("/home/you/Library");
    clearVaultPath();
    expect(readVaultPath()).toBeNull();
  });

  it("ignores blank stored paths", () => {
    persistVaultPath("   ");
    expect(readVaultPath()).toBeNull();
  });
});

describe("vault file helpers", () => {
  it("recognizes supported document extensions", () => {
    expect(isSupportedVaultFile("notes.md")).toBe(true);
    expect(isSupportedVaultFile("PAPER.PDF")).toBe(true);
    expect(isSupportedVaultFile("data.csv")).toBe(true);
    expect(isSupportedVaultFile("README")).toBe(false);
    expect(isSupportedVaultFile("track.mp3")).toBe(false);
  });

  it("turns a tree entry into a path source", () => {
    expect(vaultSource({ name: "note.md", absolutePath: "/vault/note.md" })).toEqual({
      kind: "path",
      name: "note.md",
      path: "/vault/note.md",
    });
  });

  it("keeps paths inside the configured library", () => {
    expect(isVaultPath("/home/you/Library/note.md", "/home/you/Library")).toBe(true);
    expect(isVaultPath("/home/you/Library/deep/note.md", "/home/you/Library/")).toBe(true);
    expect(isVaultPath("/home/you/Library-other/note.md", "/home/you/Library")).toBe(false);
    expect(isVaultPath("/home/you/Library", "/home/you/Library")).toBe(false);
    expect(isVaultPath(undefined, "/home/you/Library")).toBe(false);
    expect(isVaultPath("C:\\Library\\note.md", "C:\\Library")).toBe(true);
  });
});

describe("browser preview behavior", () => {
  it("derives vault info from the stored path", async () => {
    expect(await fetchVaultInfo()).toBeNull();
    persistVaultPath("/home/you/vault");
    await expect(fetchVaultInfo()).resolves.toEqual({
      path: "/home/you/vault",
      name: "vault",
      exists: true,
      writable: false,
    });
  });

  it("saves a configured path locally", async () => {
    const info = await configureVault("/home/you/new-vault");
    expect(info.name).toBe("new-vault");
    expect(readVaultPath()).toBe("/home/you/new-vault");
  });

  it("explains that tree listing needs the desktop app", async () => {
    await expect(listVaultEntries()).rejects.toThrow("desktop app");
  });
});

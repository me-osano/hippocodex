import { beforeEach, describe, expect, it } from "vitest";
import { addRecent, clearRecents, loadRecents, removeRecent } from "./recents";
import type { RecentDocument } from "../types";

function recent(overrides: Partial<RecentDocument> = {}): RecentDocument {
  return {
    id: "path",
    name: "paper.pdf",
    size: 1024,
    kind: "pdf",
    openedAt: 100,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("recents", () => {
  it("returns an empty list when storage is empty or corrupt", () => {
    expect(loadRecents()).toEqual([]);
    window.localStorage.setItem("hippocodex.recents.v1", "{not json");
    expect(loadRecents()).toEqual([]);  });

  it("persists and deduplicates entries, newest first", () => {
    const first = addRecent([], recent({ id: "a", openedAt: 10 }));
    const second = addRecent(first, recent({ id: "b", openedAt: 20 }));
    const moved = addRecent(second, recent({ id: "a", openedAt: 30 }));

    expect(moved.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(loadRecents().map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("removes and clears entries", () => {
    const entries = addRecent([], recent({ id: "a" }));
    expect(removeRecent(entries, "a")).toEqual([]);
    expect(loadRecents()).toEqual([]);

    addRecent([], recent({ id: "b" }));
    expect(clearRecents()).toEqual([]);
    expect(loadRecents()).toEqual([]);
  });

  it("ignores malformed entries", () => {
    window.localStorage.setItem(
      "hippocodex.recents.v1",
      JSON.stringify([{ id: "ok", name: "a", size: 1, kind: "pdf", openedAt: 1 }, { nope: true }]),
    );
    expect(loadRecents()).toHaveLength(1);
  });
});

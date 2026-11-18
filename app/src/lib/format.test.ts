import { describe, expect, it } from "vitest";
import { basename, clamp, displayPath, formatBytes, formatRelativeDate, pluralize } from "./format";

describe("formatBytes", () => {
  it("formats byte sizes compactly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(15 * 1024)).toBe("15 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(Number.NaN)).toBe("—");
  });
});

describe("formatRelativeDate", () => {
  const now = 1_700_000_000_000;
  it("describes recent timestamps", () => {
    expect(formatRelativeDate(now - 20_000, now)).toBe("just now");
    expect(formatRelativeDate(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(formatRelativeDate(now - 3 * 60 * 60_000, now)).toBe("3 hours ago");
    expect(formatRelativeDate(now - 2 * 24 * 60 * 60_000, now)).toBe("2 days ago");
  });
});

describe("path helpers", () => {
  it("extracts basenames across separators", () => {
    expect(basename("/home/me/paper.pdf")).toBe("paper.pdf");
    expect(basename("C:\\Users\\me\\paper.pdf")).toBe("paper.pdf");
    expect(basename("paper.pdf")).toBe("paper.pdf");
  });

  it("shortens long display paths", () => {
    expect(displayPath("/home/me/paper.pdf")).toBe("/home/me/paper.pdf");
    expect(displayPath("/a/b/c/d/paper.pdf")).toBe("…/d/paper.pdf");
    expect(displayPath(undefined)).toBeUndefined();
  });
});

it("clamps and pluralizes", () => {
  expect(clamp(5, 0, 3)).toBe(3);
  expect(clamp(-1, 0, 3)).toBe(0);
  expect(pluralize(1, "page")).toBe("1 page");
  expect(pluralize(2, "page")).toBe("2 pages");
});

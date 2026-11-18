import { describe, expect, it, vi } from "vitest";
import {
  findHitsInText,
  normalizePdfText,
  searchPdfDocument,
  textFromItems,
} from "./pdfSearch";

describe("pdf text helpers", () => {
  it("normalizes whitespace", () => {
    expect(normalizePdfText("  a\n\t b   c ")).toBe("a b c");
  });

  it("joins text items with spacing and line breaks", () => {
    expect(
      textFromItems([
        { str: "Hello" },
        { str: "world" },
        { str: "next line", hasEOL: true },
        { str: "after" },
        { type: "beginMarkedContent" },
      ]),
    ).toBe("Hello world next line\nafter ");
  });

  it("finds case-insensitive hits with snippets", () => {
    const text = "The hippocampus is seahorse-shaped. The hippocampus stores memories.";
    const hits = findHitsInText(text, "HIPPOCAMPUS", 4);
    expect(hits).toHaveLength(2);
    expect(hits[0].page).toBe(4);
    expect(hits[0].snippet.toLowerCase()).toContain("hippocampus");
  });

  it("handles whitespace-spanning queries and limits matches", () => {
    const text = "alpha   beta alpha beta alpha beta";
    expect(findHitsInText(text, "alpha beta", 1)).toHaveLength(3);
    expect(findHitsInText("x ".repeat(40), "x", 1, 5)).toHaveLength(5);
  });

  it("returns nothing for an empty query", () => {
    expect(findHitsInText("anything", "   ", 1)).toEqual([]);
  });
});

describe("searchPdfDocument", () => {
  it("searches every page and reports progress", async () => {
    const pages: Record<number, string> = {
      1: "first page mentions alpha",
      2: "second page has beta",
      3: "third page mentions alpha twice: alpha",
    };
    const pdf = {
      numPages: 3,
      getPage: vi.fn(async (pageNumber: number) => ({
        getTextContent: async () => ({ items: [{ str: pages[pageNumber] }] }),
      })),
    };
    const progress = vi.fn();
    const hits = await searchPdfDocument(pdf, "alpha", progress);

    expect(pdf.getPage).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenLastCalledWith({ page: 3, total: 3 });
    expect(hits.map((hit) => hit.page)).toEqual([1, 3, 3]);
  });

  it("stops when cancelled", async () => {
    const pdf = {
      numPages: 2,
      getPage: vi.fn(async () => ({
        getTextContent: async () => ({ items: [{ str: "alpha" }] }),
      })),
    };
    const hits = await searchPdfDocument(pdf, "alpha", undefined, () => true);
    expect(hits).toEqual([]);
    expect(pdf.getPage).not.toHaveBeenCalled();
  });
});

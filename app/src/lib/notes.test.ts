import { describe, expect, it } from "vitest";
import {
  createNote,
  isEditableNote,
  normalizeNoteName,
  noteExtension,
  noteFileName,
  noteTemplate,
} from "./notes";
import { decodeUtf8, encodeUtf8 } from "./text";

describe("note names", () => {
  it("trims names and strips note extensions", () => {
    expect(normalizeNoteName("  Ideas.md  ")).toEqual({ value: "Ideas" });
    expect(normalizeNoteName("scratch.txt")).toEqual({ value: "scratch" });
    expect(normalizeNoteName("draft.MARKDOWN")).toEqual({ value: "draft" });
  });

  it("rejects empty, hidden, oversized, and path-like names", () => {
    expect(normalizeNoteName("   ").error).toBeTruthy();
    expect(normalizeNoteName(".hidden").error).toContain("dot");
    expect(normalizeNoteName("..").error).toContain("dot");
    expect(normalizeNoteName("a".repeat(81)).error).toContain("80");
    expect(normalizeNoteName("../escape").error).toContain("path symbols");
    expect(normalizeNoteName("sub/note").error).toContain("path symbols");
    expect(normalizeNoteName("C:\\notes").error).toContain("path symbols");
    expect(normalizeNoteName("bad\u0000name").error).toContain("path symbols");
  });

  it("builds file names and starter content for both formats", () => {
    expect(noteFileName("Ideas", "md")).toBe("Ideas.md");
    expect(noteFileName("Ideas", "txt")).toBe("Ideas.txt");
    expect(noteTemplate("Ideas", "md")).toBe("# Ideas\n\n");
    expect(noteTemplate("Ideas", "txt")).toBe("Ideas\n\n");
  });

  it("recognizes note extensions", () => {
    expect(noteExtension("ideas.MD")).toBe("md");
    expect(noteExtension("notes.txt")).toBe("txt");
    expect(noteExtension("README")).toBeNull();
  });
});

describe("editing eligibility", () => {
  const library = "/home/you/Library";

  it("allows session notes without a path", () => {
    expect(isEditableNote({ name: "ideas.md", kind: "markdown", path: undefined }, library)).toBe(
      true,
    );
    expect(isEditableNote({ name: "notes.txt", kind: "text", path: undefined }, null)).toBe(true);
  });

  it("confines disk notes to the configured Library", () => {
    expect(
      isEditableNote(
        { name: "ideas.md", kind: "markdown", path: `${library}/ideas.md` },
        library,
      ),
    ).toBe(true);
    expect(
      isEditableNote(
        { name: "ideas.md", kind: "markdown", path: "/home/you/Other/ideas.md" },
        library,
      ),
    ).toBe(false);
    expect(
      isEditableNote({ name: "ideas.md", kind: "markdown", path: `${library}/ideas.md` }, null),
    ).toBe(false);
  });

  it("does not offer editing for other kinds or extensions", () => {
    expect(isEditableNote({ name: "paper.pdf", kind: "pdf", path: undefined }, library)).toBe(
      false,
    );
    expect(isEditableNote({ name: "ideas.markdown", kind: "markdown", path: undefined }, library)).toBe(
      false,
    );
  });
});

describe("note bytes", () => {
  it("round-trips edited UTF-8 text", () => {
    const text = "# Lecture — 恋愛\n\nLine two\r\n";
    expect(decodeUtf8(encodeUtf8(text))).toBe(text);
  });
});

describe("browser preview notes", () => {
  it("keeps a new note in memory instead of writing to disk", async () => {
    const result = await createNote(" Lecture notes.md ", "md");
    expect(result.saved).toBe(false);
    expect(result.source.kind).toBe("file");
    expect(result.source.name).toBe("Lecture notes.md");
    expect(result.source.file?.type).toBe("text/markdown");
    expect(result.source.file?.size).toBe("# Lecture notes\n\n".length);
  });

  it("creates plain-text notes", async () => {
    const result = await createNote("scratch", "txt");
    expect(result.source.name).toBe("scratch.txt");
    expect(result.source.file?.type).toBe("text/plain");
    expect(result.source.file?.size).toBe("scratch\n\n".length);
  });

  it("refuses invalid names", async () => {
    await expect(createNote("../escape", "md")).rejects.toThrow("path symbols");
  });
});

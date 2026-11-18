import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  UnsupportedFileError,
  detectFileType,
  extensionOf,
  isSupportedExtension,
  languageForFile,
} from "./filetype";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("extensionOf", () => {
  it("handles ordinary names, dotfiles, and queries", () => {
    expect(extensionOf("paper.pdf")).toBe("pdf");
    expect(extensionOf("Notes.MD")).toBe("md");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
    expect(extensionOf(".env")).toBe("");
    expect(extensionOf("README")).toBe("");
    expect(extensionOf("file.pdf?download=1")).toBe("pdf");
  });
});

describe("detectFileType", () => {
  it("detects PDFs by signature even with the wrong extension", () => {
    const result = detectFileType("misnamed.txt", text("%PDF-1.7\n..."));
    expect(result.kind).toBe("pdf");
    expect(result.reason).toContain("PDF");
  });

  it("rejects a PDF extension without a PDF header", () => {
    expect(() => detectFileType("broken.pdf", text("not a pdf"))).toThrow(UnsupportedFileError);
  });

  it("detects images by magic bytes", () => {
    expect(detectFileType("photo.dat", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)).kind).toBe("image");
    expect(detectFileType("photo.jpg", bytes(0xff, 0xd8, 0xff, 0xe0)).extension).toBe("jpg");
  });

  it("detects markdown, CSV, Excel, code, and DOCX", () => {
    expect(detectFileType("notes.md", text("# Notes")).kind).toBe("markdown");
    expect(detectFileType("table.csv", text("a,b\n1,2")).kind).toBe("csv");
    expect(detectFileType("budget.xlsx", bytes(0x50, 0x4b, 0x03, 0x04, 1, 2, 3)).kind).toBe("spreadsheet");
    const code = detectFileType("main.rs", text("fn main() {}"));
    expect(code.kind).toBe("code");
    expect(code.language).toBe("rust");
    const docx = detectFileType("report.docx", bytes(0x50, 0x4b, 0x03, 0x04, 1, 2, 3));
    expect(docx.kind).toBe("docx");
  });

  it("detects PPTX decks by their ZIP container", async () => {
    const zip = new JSZip();
    zip.file("ppt/presentation.xml", "<p:presentation/>");
    zip.file("ppt/slides/slide1.xml", "<p:sld/>");
    const deck = await zip.generateAsync({ type: "uint8array" });

    const result = detectFileType("slides.pptx", deck);
    expect(result.kind).toBe("presentation");
    expect(result.extension).toBe("pptx");

    // Content wins even when the deck has the wrong extension.
    expect(detectFileType("misnamed.txt", deck).kind).toBe("presentation");
  });

  it("detects legacy binary PowerPoint files", () => {
    const ole = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    const result = detectFileType("old-deck.ppt", ole);
    expect(result.kind).toBe("presentation");
    expect(result.extension).toBe("ppt");
  });

  it("keeps presentation extensions in the presentation pipeline", () => {
    // Irregular containers still belong to the viewer, which reports the
    // precise parse failure instead of mislabelling the file.
    expect(detectFileType("deck.pptx", text("not a zip")).kind).toBe("presentation");
    expect(detectFileType("deck.pps", bytes(0, 0, 0, 0, 7, 8, 0)).kind).toBe("presentation");
  });

  it("falls back to plain text for unknown textual files", () => {
    const result = detectFileType("README", text("Read me first.\n"));
    expect(result.kind).toBe("text");
  });

  it("rejects binary files with unknown extensions", () => {
    expect(() => detectFileType("blob", bytes(0, 0, 0, 0, 7, 8, 0))).toThrow(UnsupportedFileError);
  });

  it("exposes extension helpers", () => {
    expect(isSupportedExtension("md")).toBe(true);
    expect(isSupportedExtension("xlsx")).toBe(true);
    expect(isSupportedExtension("pptx")).toBe(true);
    expect(isSupportedExtension("ppt")).toBe(true);
    expect(isSupportedExtension("exe")).toBe(false);
    expect(languageForFile("script.py")).toBe("python");
  });
});

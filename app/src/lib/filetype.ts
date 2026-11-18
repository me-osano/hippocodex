import type { DocumentKind } from "../types";

const EXTENSION_KINDS: Record<string, DocumentKind> = {
  pdf: "pdf",
  md: "markdown",
  markdown: "markdown",
  mdown: "markdown",
  mkd: "markdown",
  mdx: "markdown",
  txt: "text",
  text: "text",
  log: "text",
  csv: "csv",
  tsv: "csv",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  xlsm: "spreadsheet",
  xlsb: "spreadsheet",
  docx: "docx",
  ppt: "presentation",
  pptx: "presentation",
  pptm: "presentation",
  pps: "presentation",
  ppsx: "presentation",
  pot: "presentation",
  potx: "presentation",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  svg: "image",
  ico: "image",
};

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  json: "json",
  jsonc: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  xml: "xml",
  html: "xml",
  htm: "xml",
  xhtml: "xml",
  svg: "xml",
  css: "css",
  scss: "scss",
  less: "less",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  sql: "sql",
  rb: "ruby",
  php: "php",
  swift: "swift",
  lua: "lua",
  r: "r",
  tex: "latex",
  bib: "bibtex",
  dockerfile: "dockerfile",
  makefile: "makefile",
  ini: "ini",
  conf: "ini",
  diff: "diff",
  patch: "diff",
};

export interface DetectedFile {
  kind: DocumentKind;
  extension: string;
  language?: string;
  reason: string;
}

export class UnsupportedFileError extends Error {
  constructor(name: string, reason: string) {
    super(reason ? `Can't open “${name}”: ${reason}` : `Can't open “${name}”.`);
    this.name = "UnsupportedFileError";
  }
}

export function extensionOf(name: string): string {
  const clean = name.split(/[?#]/, 1)[0];
  const index = clean.lastIndexOf(".");
  if (index <= 0 || index === clean.length - 1) return "";
  return clean.slice(index + 1).toLowerCase();
}

export function stemOf(name: string): string {
  const base = name.replace(/^.*[/\\]/, "");
  const index = base.lastIndexOf(".");
  return index <= 0 ? base : base.slice(0, index);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, Math.min(end, bytes.length)));
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/** Identify an OOXML container from entry names in the local/central directory. */
function zipContainerKind(bytes: Uint8Array): DocumentKind | null {
  const decoder = new TextDecoder("latin1");
  const size = 256 * 1024;
  const head = decoder.decode(bytes.subarray(0, Math.min(bytes.length, size)));
  const tail = decoder.decode(bytes.subarray(Math.max(0, bytes.length - size)));
  const names = `${head}\n${tail}`;
  if (names.includes("ppt/slides/")) return "presentation";
  if (names.includes("xl/")) return "spreadsheet";
  if (names.includes("word/")) return "docx";
  return null;
}

interface MagicResult {
  kind: DocumentKind;
  extension?: string;
  reason: string;
}

function detectMagic(bytes: Uint8Array, extension: string): MagicResult | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
    return { kind: "pdf", extension: "pdf", reason: "PDF signature" };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "image", extension: "png", reason: "PNG signature" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { kind: "image", extension: "jpg", reason: "JPEG signature" };
  }
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return { kind: "image", extension: "gif", reason: "GIF signature" };
  }
  if (startsWith(bytes, [0x42, 0x4d])) {
    return { kind: "image", extension: "bmp", reason: "BMP signature" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return { kind: "image", extension: "webp", reason: "WebP signature" };
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const container = zipContainerKind(bytes) ?? "docx";
    const extensionHint = container === "presentation" ? "pptx" : container === "spreadsheet" ? "xlsx" : "docx";
    return { kind: container, extension: extensionHint, reason: "ZIP container" };
  }
  // Legacy PowerPoint (.ppt/.pps/.pot) is an OLE compound file.
  if (
    startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) &&
    (extension === "ppt" || extension === "pps" || extension === "pot")
  ) {
    return { kind: "presentation", extension, reason: "PowerPoint binary container" };
  }
  return null;
}

function looksBinary(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 16_384);
  if (sample.length === 0) return false;
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) suspicious += 4;
    else if (byte < 7 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return suspicious / sample.length > 0.08;
}

/**
 * Detect a document type from its name, with content-based overrides for the
 * formats where a wrong extension is common (PDF, images, DOCX containers).
 */
export function detectFileType(name: string, bytes: Uint8Array): DetectedFile {
  const extension = extensionOf(name);
  const byExtension = EXTENSION_KINDS[extension];
  const magic = detectMagic(bytes, extension);

  // Content wins over the extension for formats with reliable signatures. A
  // PDF renamed to .txt should still open, and a PNG renamed to .md should not
  // be rendered as markdown.
  if (magic) {
    if (magic.kind === "presentation") {
      return {
        kind: "presentation",
        extension: magic.extension ?? extension,
        reason: magic.reason,
      };
    }
    if (magic.kind === "docx") {
      // detectMagic falls back to DOCX for unrecognised ZIP containers. Keep a
      // presentation extension in the presentation pipeline so the viewer can
      // report a precise parse error instead of mislabelling the file.
      if (byExtension === "presentation") {
        return { kind: "presentation", extension, reason: "ZIP container" };
      }
      if (byExtension !== "docx" && byExtension !== "spreadsheet") {
        throw new UnsupportedFileError(
          name,
          "ZIP containers are only supported as .docx, .xlsx, or PowerPoint documents",
        );
      }
      if (byExtension === "spreadsheet") {
        return { kind: "spreadsheet", extension, reason: "ZIP container" };
      }
    }
    return {
      kind: magic.kind,
      extension: magic.extension ?? extension,
      reason: magic.reason,
    };
  }

  if (byExtension === "pdf") {
    // Some PDFs begin with whitespace or a BOM before %PDF.
    const head = ascii(bytes, 0, 1024);
    const index = head.indexOf("%PDF-");
    if (index !== -1) return { kind: "pdf", extension, reason: "PDF signature" };
    if (bytes.length === 0) throw new UnsupportedFileError(name, "the file is empty");
    throw new UnsupportedFileError(name, "the file does not contain a PDF header");
  }

  if (byExtension === "image") {
    throw new UnsupportedFileError(name, "the image format is not recognised");
  }

  if (byExtension === "docx") {
    if (bytes.length === 0) throw new UnsupportedFileError(name, "the file is empty");
    // Mammoth will report a specific error if this is not actually OOXML.
    return { kind: "docx", extension, reason: "DOCX extension" };
  }

  if (byExtension === "presentation") {
    if (bytes.length === 0) throw new UnsupportedFileError(name, "the file is empty");
    // The viewer inspects the bytes to pick the PPTX parser or the best-effort
    // legacy recovery, and surfaces a clear error for anything else.
    return { kind: "presentation", extension, reason: `${extension.toUpperCase()} presentation` };
  }

  if (byExtension) {
    return {
      kind: byExtension,
      extension,
      language: LANGUAGE_BY_EXTENSION[extension],
      reason: `${extension.toUpperCase()} extension`,
    };
  }

  if (LANGUAGE_BY_EXTENSION[extension]) {
    return {
      kind: "code",
      extension,
      language: LANGUAGE_BY_EXTENSION[extension],
      reason: `${extension.toUpperCase()} source file`,
    };
  }

  if (looksBinary(bytes)) {
    throw new UnsupportedFileError(
      name,
      "this looks like a binary file. Supported formats are PDF, Markdown, text, code, CSV/TSV, DOCX, PowerPoint, and images",
    );
  }

  return { kind: "text", extension, reason: "plain text content" };
}

export function kindAcceptsExtension(kind: DocumentKind, extension: string): boolean {
  if (EXTENSION_KINDS[extension] === kind) return true;
  return kind === "code" && Boolean(LANGUAGE_BY_EXTENSION[extension]);
}

export function isSupportedExtension(extension: string): boolean {
  return Boolean(EXTENSION_KINDS[extension] ?? LANGUAGE_BY_EXTENSION[extension]);
}

export function languageForFile(name: string): string | undefined {
  return LANGUAGE_BY_EXTENSION[extensionOf(name)];
}

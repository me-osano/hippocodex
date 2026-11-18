export const APP_NAME = "Hippocodex";
export const APP_VERSION = "0.1.0";

export type DocumentKind =
  | "pdf"
  | "markdown"
  | "text"
  | "code"
  | "image"
  | "csv"
  | "spreadsheet"
  | "docx"
  | "presentation";

export const KIND_LABELS: Record<DocumentKind, string> = {
  pdf: "PDF",
  markdown: "Markdown",
  text: "Text",
  code: "Code",
  image: "Image",
  csv: "Spreadsheet",
  spreadsheet: "Excel workbook",
  docx: "Word document",
  presentation: "PowerPoint presentation",
};

export const KIND_DESCRIPTIONS: Record<DocumentKind, string> = {
  pdf: "Portable Document Format",
  markdown: "Markdown document",
  text: "Plain text",
  code: "Source code",
  image: "Image file",
  csv: "Delimited text table",
  spreadsheet: "Microsoft Excel workbook",
  docx: "Office Open XML document",
  presentation: "PowerPoint slide deck",
};

export interface FileSource {
  kind: "path" | "file";
  path?: string;
  file?: File;
  name: string;
}

export interface OpenDocument {
  id: string;
  name: string;
  size: number;
  kind: DocumentKind;
  language?: string;
  bytes: Uint8Array;
  path?: string;
  openedAt: number;
}

export interface RecentDocument {
  id: string;
  name: string;
  size: number;
  kind: DocumentKind;
  path?: string;
  openedAt: number;
}

export interface OutlineEntry {
  title: string;
  dest: unknown;
  items: OutlineEntry[];
}

export interface PdfSearchHit {
  page: number;
  snippet: string;
  offset: number;
}

export interface PdfSearchProgress {
  page: number;
  total: number;
}

export const SUPPORTED_EXTENSIONS = [
  "pdf",
  "md",
  "markdown",
  "mdown",
  "txt",
  "text",
  "csv",
  "tsv",
  "xlsx",
  "xls",
  "xlsm",
  "xlsb",
  "docx",
  "ppt",
  "pptx",
  "pptm",
  "pps",
  "ppsx",
  "pot",
  "potx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "bmp",
  "svg",
  "json",
  "yaml",
  "yml",
  "toml",
  "xml",
  "html",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "rs",
  "go",
  "java",
  "c",
  "h",
  "cpp",
  "hpp",
  "sh",
  "sql",
  "rb",
  "php",
  "swift",
  "kt",
  "lua",
  "r",
  "tex",
  "bib",
] as const;

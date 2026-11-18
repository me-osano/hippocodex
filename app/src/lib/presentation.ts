/** One body paragraph, with the bullet and nesting taken from the slide's
 * list styles (paragraph -> shape -> layout -> master). */
export interface SlideParagraph {
  text: string;
  level: number;
  bullet?: string;
}

export interface ParsedSlide {
  number: number;
  title: string;
  paragraphs: SlideParagraph[];
  notes: string;
  /** The author marked this slide to be skipped during a slide show. */
  hidden?: boolean;
}

export interface ParsedPresentation {
  slides: ParsedSlide[];
  format: "pptx" | "legacy";
  notice?: string;
}

/** PK zip local/central-directory signature (all modern OOXML decks). */
export function isZipContainer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] >= 0x03 &&
    bytes[2] <= 0x07 &&
    bytes[3] >= 0x04 &&
    bytes[3] <= 0x08
  );
}

/** OLE compound-file signature (legacy binary .ppt/.pps/.pot). */
export function isOleContainer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

/**
 * Pick the right local parser from the file's container. Never sends data
 * anywhere; both parsers operate entirely on the in-memory bytes.
 */
export async function parsePresentation(
  bytes: Uint8Array,
  extension: string,
): Promise<ParsedPresentation> {
  if (isZipContainer(bytes)) {
    const { parsePptx } = await import("./pptx");
    return parsePptx(bytes);
  }
  if (isOleContainer(bytes)) {
    const { parseLegacyPpt } = await import("./ppt");
    return parseLegacyPpt(bytes, extension);
  }
  throw new Error(
    "This file is not a recognisable PowerPoint container. Expected a .pptx ZIP or a legacy .ppt binary file.",
  );
}

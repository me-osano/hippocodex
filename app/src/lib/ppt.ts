import type { ParsedPresentation, ParsedSlide } from "./presentation";

const TEXT_CHARS_ATOM = 0x0fa0; // UTF-16LE text
const TEXT_BYTES_ATOM = 0x0fa8; // ANSI text
const SLIDE_CONTAINER = 0x03ee; // marks the start of a slide

interface RecordHit {
  offset: number;
  type: number;
  length: number;
  /** Whether the record header (and its UTF-16 text) is little-endian. */
  little: boolean;
}

function readU32(bytes: Uint8Array, offset: number, little: boolean): number {
  if (little) {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      bytes[offset + 3] * 0x1000000
    );
  }
  return (
    bytes[offset] * 0x1000000 |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  );
}

/**
 * Scan the compound file for record headers, tolerating both byte orders used
 * by PowerPoint writers. This is deliberately shallow: a full binary-PPT
 * renderer is out of scope, but the text atoms are recoverable everywhere.
 */
function scanRecords(bytes: Uint8Array, targets: number[]): RecordHit[] {
  const wanted = new Set(targets);
  const hits: RecordHit[] = [];
  for (let offset = 0; offset + 8 <= bytes.length; offset += 1) {
    const first = bytes[offset];
    const second = bytes[offset + 1];
    const little = first | (second << 8);
    const big = (first << 8) | second;
    let type: number | null = null;
    let isLittle = true;
    if (wanted.has(little)) {
      type = little;
      isLittle = true;
    } else if (wanted.has(big)) {
      type = big;
      isLittle = false;
    }
    if (type === null) continue;
    const length = readU32(bytes, offset + 4, isLittle);
    if (length <= 0 || length > 4 * 1024 * 1024) continue;
    if (offset + 8 + length > bytes.length) continue;
    hits.push({ offset, type, length, little: isLittle });
  }
  return hits;
}

function decodeUtf16(payload: Uint8Array, little: boolean): string {
  let out = "";
  for (let index = 0; index + 1 < payload.length; index += 2) {
    out += String.fromCharCode(
      little
        ? payload[index] | (payload[index + 1] << 8)
        : (payload[index] << 8) | payload[index + 1],
    );
  }
  return out;
}

function decodeLatin1(payload: Uint8Array): string {
  let out = "";
  for (const byte of payload) out += String.fromCharCode(byte);
  return out;
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/\u000b/g, "\n")
    .replace(/[\u0000-\u0008\u000c\u000e-\u001f]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Best-effort text recovery for legacy binary PowerPoint decks. */
export function parseLegacyPpt(bytes: Uint8Array, extension: string): ParsedPresentation {
  const records = scanRecords(bytes, [SLIDE_CONTAINER, TEXT_CHARS_ATOM, TEXT_BYTES_ATOM]);
  const slideStarts = records
    .filter((record) => record.type === SLIDE_CONTAINER)
    .map((record) => record.offset);
  const atoms = records.filter(
    (record) => record.type === TEXT_CHARS_ATOM || record.type === TEXT_BYTES_ATOM,
  );

  if (atoms.length === 0) {
    throw new Error("No recoverable text was found in this legacy PowerPoint file.");
  }

  const groups = new Map<number, string[]>();
  for (const atom of atoms) {
    // A record length can be odd; ignore only the trailing byte, not the atom.
    const payloadLength =
      atom.type === TEXT_CHARS_ATOM ? atom.length - (atom.length % 2) : atom.length;
    const payload = bytes.subarray(atom.offset + 8, atom.offset + 8 + payloadLength);
    const raw = atom.type === TEXT_CHARS_ATOM ? decodeUtf16(payload, atom.little) : decodeLatin1(payload);
    const text = cleanText(raw);
    if (!text) continue;

    let slideIndex = 0;
    for (const start of slideStarts) {
      if (start > atom.offset) break;
      slideIndex += 1;
    }
    const paragraphs = groups.get(slideIndex) ?? [];
    if (!paragraphs.includes(text)) paragraphs.push(text);
    groups.set(slideIndex, paragraphs);
  }

  const indices = Array.from(groups.keys()).sort((a, b) => a - b);
  const slides: ParsedSlide[] = indices.map((index, position) => {
    const text = groups.get(index) ?? [];
    return {
      number: position + 1,
      title: text[0] ?? `Slide ${position + 1}`,
      paragraphs: text.map((line) => ({ text: line, level: 0 })),
      notes: "",
    };
  });

  return {
    slides,
    format: "legacy",
    notice: `Recovered text from a legacy binary PowerPoint container (${extension.toUpperCase()} extension). Slide layout, images, charts, and speaker notes are not available, and text order may be imperfect.`,
  };
}

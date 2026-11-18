/**
 * Guarded ZIP access for document viewers.
 *
 * A PowerPoint (or Word/Excel) file is a ZIP chosen by the reader. A hostile
 * archive can be tiny on disk and claim to inflate to gigabytes, exhausting
 * webview memory before a viewer gets a say. Paperwren solves this with a
 * three-stage guard; this module applies the same discipline to the JSZip
 * reader already used here:
 *
 * 1. Read the end-of-central-directory record and directory ourselves, before
 *    inflating anything. Refuse ZIP64, multi-disk archives, impossible
 *    offsets, too many entries, and entries that claim too much output.
 * 2. Charge every entry we actually inflate against a byte budget, using the
 *    directory's declared sizes. Entries that are not read cost nothing.
 * 3. Verify the decoded size after inflation, so a lying header cannot silently
 *    inflate beyond the budget.
 *
 * The XML/rels parts a presentation reader needs are small; a deck with a
 * large embedded video is fine, because its media is never inflated.
 */

import JSZip from "jszip";

/** Raised when an archive is refused, before or after inflating. */
export class ZipTooLarge extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipTooLarge";
  }
}

export interface ZipLimits {
  /** Most entries an archive may hold. */
  maxEntries: number;
  /** Most bytes the entries a caller inflates may allocate in total. */
  maxBytes: number;
  /** Most bytes a single inflated entry may allocate. */
  maxEntryBytes: number;
  /** How far a deflated entry may claim to expand past its compressed size. */
  maxRatio: number;
}

const MB = 1024 * 1024;

/** Deflate cannot expand much past ~1032:1; the ratio sits just above that. */
export const ZIP_LIMITS: ZipLimits = {
  maxEntries: 8192,
  maxBytes: 64 * MB,
  maxEntryBytes: 32 * MB,
  maxRatio: 1100,
};

interface EntryMeta {
  path: string;
  size: number;
  compressed: number;
  method: number;
  encrypted: boolean;
}

export interface ZipScan {
  /** Lowercased part name -> declared sizes. */
  entries: Map<string, EntryMeta>;
}

export interface SafeZipOptions {
  limits?: Partial<ZipLimits>;
  /** Skip parts the caller will never read, before inflation. */
  allowed?: (path: string) => boolean;
}

export interface SafeZip {
  /** Declared part names, for callers that need to discover parts. */
  paths(): string[];
  has(path: string): boolean;
  readBytes(path: string): Promise<Uint8Array | null>;
  read(path: string): Promise<string | null>;
}

const STORED = 0;
const DEFLATED = 8;
const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_MARKER = 0xffffffff;
const MAX_COMMENT = 0xffff;

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function decodeName(bytes: Uint8Array, offset: number, length: number): string {
  return new TextDecoder().decode(bytes.subarray(offset, offset + length));
}

function emptyScan(): ZipScan {
  return { entries: new Map() };
}

/**
 * Read the archive's directory without inflating anything. Archives this
 * scan cannot locate are returned empty; the caller's inflater reports the
 * malformed ZIP in its own way, and the byte budget still applies.
 */
export function scanZip(bytes: Uint8Array, limits: ZipLimits = ZIP_LIMITS): ZipScan {
  if (bytes.length < 22) return emptyScan();

  let eocd = -1;
  const from = Math.max(0, bytes.length - 22 - MAX_COMMENT);
  for (let index = bytes.length - 22; index >= from; index -= 1) {
    if (u32(bytes, index) === EOCD) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) return emptyScan();

  // fflate (and JSZip) follow a ZIP64 locator to a second directory this
  // scan would never see. No document a reader opens needs ZIP64.
  if (eocd >= 20 && u32(bytes, eocd - 20) === ZIP64_LOCATOR) {
    throw new ZipTooLarge("ZIP64 archives are too large to open safely.");
  }
  if (u16(bytes, eocd + 4) !== 0 || u16(bytes, eocd + 6) !== 0) {
    throw new ZipTooLarge("Multi-disk archives are not supported.");
  }

  const count = Math.max(u16(bytes, eocd + 8), u16(bytes, eocd + 10));
  if (count === 0xffff || count > limits.maxEntries) {
    throw new ZipTooLarge(`This archive holds ${count.toLocaleString()} entries.`);
  }

  const directorySize = u32(bytes, eocd + 12);
  const recordedOffset = u32(bytes, eocd + 16);
  // Archives with prepended bytes record offsets from the archive start, not
  // from the file start. The gap between the recorded and actual directory
  // position is that prefix.
  const prefix = eocd - directorySize - recordedOffset;
  const start = prefix >= 0 ? recordedOffset + prefix : recordedOffset;
  if (start < 0 || start + directorySize > bytes.length) return emptyScan();

  const entries = new Map<string, EntryMeta>();
  let at = start;
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > start + directorySize || u32(bytes, at) !== CENTRAL) break;

    const flags = u16(bytes, at + 8);
    const method = u16(bytes, at + 10);
    const compressed = u32(bytes, at + 20);
    const size = u32(bytes, at + 24);
    const nameLength = u16(bytes, at + 28);
    const extraLength = u16(bytes, at + 30);
    const commentLength = u16(bytes, at + 32);

    if (compressed === ZIP64_MARKER || size === ZIP64_MARKER) {
      throw new ZipTooLarge("ZIP64 entries are too large to open safely.");
    }
    if (size > limits.maxEntryBytes) {
      throw new ZipTooLarge("An entry in this archive claims too much memory.");
    }
    if (method === STORED && compressed !== size) {
      throw new ZipTooLarge("This archive has inconsistent entry sizes.");
    }
    if (
      method === DEFLATED &&
      compressed > 0 &&
      size / compressed > limits.maxRatio
    ) {
      throw new ZipTooLarge("An entry in this archive expands implausibly far.");
    }

    const rawPath = decodeName(bytes, at + 46, nameLength);
    if (rawPath) {
      entries.set(normalize(rawPath), {
        path: rawPath,
        size,
        compressed,
        method,
        encrypted: (flags & 1) !== 0,
      });
    }
    at += 46 + nameLength + extraLength + commentLength;
  }

  return { entries };
}

/** Open an archive, refusing hostile claims before JSZip inflates anything. */
export async function openSafeZip(
  bytes: Uint8Array,
  options: SafeZipOptions = {},
): Promise<SafeZip> {
  const limits = { ...ZIP_LIMITS, ...options.limits };
  const scan = scanZip(bytes, limits);
  const zip = await JSZip.loadAsync(bytes.slice().buffer as ArrayBuffer);

  const files = new Map<string, JSZip.JSZipObject>();
  for (const file of Object.values(zip.files)) {
    if (!file.dir) files.set(normalize(file.name), file);
  }

  const cache = new Map<string, Uint8Array | null>();
  let budget = limits.maxBytes;
  const decoder = new TextDecoder();

  const readBytes = async (path: string): Promise<Uint8Array | null> => {
    const key = normalize(path);
    if (cache.has(key)) return cache.get(key) ?? null;
    if (options.allowed && !options.allowed(key)) {
      cache.set(key, null);
      return null;
    }

    const meta = scan.entries.get(key);
    if (meta?.encrypted) {
      throw new Error("This file is password-protected and cannot be read.");
    }
    if (meta && meta.size > limits.maxEntryBytes) {
      throw new ZipTooLarge("An entry in this archive claims too much memory.");
    }
    if (meta && meta.size > budget) {
      throw new ZipTooLarge("This document unpacks to more than is safe to hold.");
    }

    const file = files.get(key);
    if (!file) {
      cache.set(key, null);
      return null;
    }
    const data = await file.async("uint8array");
    // Guard archives the directory scan could not read as well.
    if (data.byteLength > limits.maxEntryBytes) {
      throw new ZipTooLarge("An entry in this archive claims too much memory.");
    }
    if (meta && data.byteLength !== meta.size) {
      throw new ZipTooLarge("An entry in this archive changed size while unpacking.");
    }
    if (data.byteLength > budget) {
      throw new ZipTooLarge("This document unpacks to more than is safe to hold.");
    }
    budget -= data.byteLength;
    cache.set(key, data);
    return data;
  };

  return {
    paths: () => Array.from(scan.entries.values(), (entry) => entry.path),
    has: (path) => files.has(normalize(path)),
    readBytes,
    read: async (path) => {
      const data = await readBytes(path);
      return data ? decoder.decode(data) : null;
    },
  };
}

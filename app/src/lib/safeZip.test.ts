import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { ZIP_LIMITS, openSafeZip, scanZip } from "./safeZip";

async function smallDeck(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("ppt/presentation.xml", "<p:presentation/>");
  zip.file("ppt/slides/slide1.xml", "<p:sld/>");
  return zip.generateAsync({ type: "uint8array" });
}

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

function putU32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function eocd(bytes: Uint8Array): number {
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (u32(bytes, index) === 0x06054b50) return index;
  }
  throw new Error("fixture has no end-of-central-directory record");
}

function centralEntries(bytes: Uint8Array): Array<{ offset: number; name: string }> {
  const end = eocd(bytes);
  const count = u16(bytes, end + 8);
  const size = u32(bytes, end + 12);
  const recorded = u32(bytes, end + 16);
  const prefix = end - size - recorded;
  let at = recorded + Math.max(0, prefix);
  const entries: Array<{ offset: number; name: string }> = [];
  for (let index = 0; index < count; index += 1) {
    if (u32(bytes, at) !== 0x02014b50) break;
    const nameLength = u16(bytes, at + 28);
    entries.push({
      offset: at,
      name: new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)),
    });
    at += 46 + nameLength + u16(bytes, at + 30) + u16(bytes, at + 32);
  }
  return entries;
}

describe("safeZip", () => {
  it("reads declared parts and ignores parts the caller did not allow", async () => {
    const zip = new JSZip();
    zip.file("ppt/presentation.xml", "<p:presentation/>");
    zip.file("ppt/media/poster.png", "x".repeat(64 * 1024));
    const bytes = await zip.generateAsync({ type: "uint8array" });

    const safe = await openSafeZip(bytes, {
      allowed: (path) => path.endsWith(".xml"),
    });
    expect(safe.paths()).toContain("ppt/presentation.xml");
    expect(await safe.read("ppt/presentation.xml")).toContain("presentation");
    expect(await safe.read("ppt/media/poster.png")).toBeNull();
    expect(await safe.read("missing.xml")).toBeNull();
  });

  it("refuses an entry that claims too much memory before inflating", async () => {
    const bytes = await smallDeck();
    const entry = centralEntries(bytes).find((item) => item.name.endsWith("slide1.xml"));
    expect(entry).toBeDefined();
    putU32(bytes, entry!.offset + 24, 40 * 1024 * 1024);

    await expect(openSafeZip(bytes)).rejects.toThrow(/too much memory/);
  });

  it("refuses ZIP64 markers and implausible expansion ratios", async () => {
    const bytes = await smallDeck();
    const entry = centralEntries(bytes).find((item) => item.name.endsWith("slide1.xml"));
    expect(entry).toBeDefined();

    const zip64 = bytes.slice();
    putU32(zip64, entry!.offset + 20, 0xffffffff);
    expect(() => scanZip(zip64)).toThrow(/ZIP64/);

    const ratio = bytes.slice();
    ratio[entry!.offset + 10] = 8; // mark as deflated so the ratio is checked
    putU32(ratio, entry!.offset + 24, 1000);
    expect(() => scanZip(ratio, { ...ZIP_LIMITS, maxRatio: 2 })).toThrow(
      /expands implausibly/,
    );
  });

  it("refuses absurd entry counts and ZIP64 locator records", async () => {
    const bytes = await smallDeck();
    const end = eocd(bytes);

    const many = bytes.slice();
    many[end + 8] = 0xff;
    many[end + 9] = 0xff;
    expect(() => scanZip(many)).toThrow(/entries/);

    const locator = bytes.slice();
    locator[end - 20] = 0x50;
    locator[end - 19] = 0x4b;
    locator[end - 18] = 0x06;
    locator[end - 17] = 0x07;
    expect(() => scanZip(locator)).toThrow(/ZIP64/);
  });
});

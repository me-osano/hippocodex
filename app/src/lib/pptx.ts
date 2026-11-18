import { bulletGlyph, listNumber } from "./bullets";
import type {
  ParsedPresentation,
  ParsedSlide,
  SlideParagraph,
} from "./presentation";
import { ZipTooLarge, openSafeZip } from "./safeZip";

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MAX_SLIDES = 500;
const MAX_LEVEL = 8;

type Reader = (path: string) => Promise<string | null>;

/** Bullet settings for one outline level. */
interface BulletStyle {
  glyph?: string | null;
  numbering?: string;
  start?: number;
}
type LevelStyles = Array<BulletStyle | undefined>;

function parseXml(xml: string): Document | null {
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return null;
    return doc;
  } catch {
    return null;
  }
}

function child(element: Element | null | undefined, local: string): Element | null {
  if (!element) return null;
  return Array.from(element.children).find((node) => node.localName === local) ?? null;
}

function nested(element: Element | null, ...locals: string[]): Element | null {
  return locals.reduce<Element | null>((current, local) => child(current, local), element);
}

function byLocal(root: Document | Element, local: string): Element[] {
  return Array.from(root.getElementsByTagNameNS("*", local));
}

function ancestor(element: Element, local: string): Element | null {
  let node = element.parentElement;
  while (node) {
    if (node.localName === local) return node;
    node = node.parentElement;
  }
  return null;
}

function relId(el: Element): string | null {
  return el.getAttributeNS(REL_NS, "id") ?? el.getAttribute("r:id");
}

function slideNumber(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/** Resolve an OOXML part target against the directory of its source part. */
function resolvePart(base: string, target: string): string {
  if (target.startsWith("/")) return target.replace(/^\/+/, "");
  const parts = base.split("/").filter(Boolean);
  for (const segment of target.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

function directoryOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

/** Read only the a:t / a:br content of a single paragraph, in document order. */
function paragraphText(paragraph: Element): string {
  let out = "";
  const visit = (node: Node): void => {
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const local = element.localName;
    if (local === "t") {
      out += element.textContent ?? "";
      return;
    }
    if (local === "br" || local === "cr") {
      out += "\n";
      return;
    }
    for (const next of Array.from(element.childNodes)) visit(next);
  };
  for (const next of Array.from(paragraph.childNodes)) visit(next);
  return out.trim();
}

function paragraphsOf(root: Element | Document): string[] {
  return byLocal(root, "p")
    .map(paragraphText)
    .filter((text) => text.length > 0);
}

/** Bullet settings declared directly on an a:pPr / a:lvlNpPr element. */
function readBullet(pPr: Element | null): BulletStyle {
  if (!pPr) return {};
  const children = Array.from(pPr.children);
  if (children.some((node) => node.localName === "buNone")) {
    return { glyph: null, numbering: undefined };
  }
  const buChar = children.find((node) => node.localName === "buChar");
  if (buChar) {
    const font = children.find((node) => node.localName === "buFont");
    return {
      glyph: bulletGlyph(
        buChar.getAttribute("char") ?? "•",
        font?.getAttribute("typeface"),
      ),
      numbering: undefined,
    };
  }
  const auto = children.find((node) => node.localName === "buAutoNum");
  if (auto) {
    return {
      glyph: null,
      numbering: auto.getAttribute("type") ?? "arabicPeriod",
      start: auto.hasAttribute("startAt")
        ? Number(auto.getAttribute("startAt"))
        : undefined,
    };
  }
  if (children.some((node) => node.localName === "buBlip")) {
    return { glyph: "•", numbering: undefined };
  }
  return {};
}

/** Read a:lvl1pPr ... a:lvl9pPr from a list-style container. */
function readLevels(container: Element | null): LevelStyles {
  const levels: LevelStyles = [];
  if (!container) return levels;
  for (let index = 0; index <= MAX_LEVEL; index += 1) {
    const pPr = child(container, `lvl${index + 1}pPr`);
    if (pPr) levels[index] = readBullet(pPr);
  }
  return levels;
}

/** Later layers override only what they actually declare. */
function mergeLevels(...layers: LevelStyles[]): LevelStyles {
  const merged: LevelStyles = [];
  for (let index = 0; index <= MAX_LEVEL; index += 1) {
    let style: BulletStyle = {};
    for (const layer of layers) {
      const next = layer[index];
      if (!next) continue;
      style = { ...style, ...next };
    }
    merged[index] = style;
  }
  return merged;
}

/** The body placeholder's list styles on a slide layout. */
function layoutLevels(layoutRoot: Element | null): LevelStyles {
  if (!layoutRoot) return [];
  for (const shape of byLocal(layoutRoot, "sp")) {
    const ph = byLocal(shape, "ph")[0];
    if (!ph) continue;
    const type = ph.getAttribute("type") ?? "body";
    if (!["body", "subTitle", "obj"].includes(type)) continue;
    const txBody = child(shape, "txBody");
    return readLevels(txBody ? child(txBody, "lstStyle") : null);
  }
  return [];
}

interface Relationship {
  type: string;
  target: string;
}

/** Read a part's .rels document, keyed by relationship Id. */
async function relationships(read: Reader, path: string): Promise<Map<string, Relationship>> {
  const dir = directoryOf(path);
  const file = path.slice(dir ? dir.length + 1 : 0);
  const xml = await read(`${dir ? `${dir}/` : ""}_rels/${file}.rels`);
  const doc = xml ? parseXml(xml) : null;
  const out = new Map<string, Relationship>();
  if (!doc) return out;
  for (const rel of byLocal(doc, "Relationship")) {
    if (rel.getAttribute("TargetMode") === "External") continue;
    const target = rel.getAttribute("Target");
    if (target) {
      out.set(rel.getAttribute("Id") ?? "", {
        type: rel.getAttribute("Type") ?? "",
        target,
      });
    }
  }
  return out;
}

function findRelationship(rels: Map<string, Relationship>, suffix: string): Relationship | null {
  for (const rel of rels.values()) {
    if (rel.type.endsWith(suffix)) return rel;
  }
  return null;
}

/**
 * Bullet styles cascade paragraph -> shape -> layout -> master, with the
 * presentation's default text style underneath. Paperwren follows the same
 * order for its visual renderer; here it keeps bulleted lists from becoming
 * a flat wall of text.
 */
async function inheritedLevels(
  read: Reader,
  presentationRoot: Element | null,
  slidePath: string,
): Promise<LevelStyles> {
  const defaults = readLevels(presentationRoot ? child(presentationRoot, "defaultTextStyle") : null);
  const slideRels = await relationships(read, slidePath);
  const layoutRel = findRelationship(slideRels, "/slideLayout");
  if (!layoutRel) return defaults;

  const layoutPath = resolvePart(directoryOf(slidePath), layoutRel.target);
  const layoutRoot = parseXml((await read(layoutPath)) ?? "")?.documentElement ?? null;
  const layoutStyles = layoutLevels(layoutRoot);

  const layoutRels = await relationships(read, layoutPath);
  const masterRel = findRelationship(layoutRels, "/slideMaster");
  let masterStyles: LevelStyles = [];
  if (masterRel) {
    const masterPath = resolvePart(directoryOf(layoutPath), masterRel.target);
    const masterRoot = parseXml((await read(masterPath)) ?? "")?.documentElement ?? null;
    masterStyles = readLevels(nested(masterRoot, "txStyles", "bodyStyle"));
  }
  return mergeLevels(defaults, masterStyles, layoutStyles);
}

interface SlideText {
  title: string;
  paragraphs: SlideParagraph[];
  hidden: boolean;
}

/** Extract the title, ordered body text, and bullet/nesting information. */
function slideText(slide: Element, levels: LevelStyles): SlideText {
  const titleShapes = byLocal(slide, "sp").filter((shape) =>
    byLocal(shape, "ph").some((ph) => {
      const type = ph.getAttribute("type") ?? "";
      return type === "title" || type === "ctrTitle";
    }),
  );

  let title = "";
  for (const shape of titleShapes) {
    const text = paragraphsOf(shape).join(" ").trim();
    if (text) {
      title = text;
      break;
    }
  }

  const counters = new Map<number, number>();
  const paragraphs: SlideParagraph[] = [];
  for (const paragraph of byLocal(slide, "p")) {
    const text = paragraphText(paragraph);
    if (!text) continue;

    const shape = ancestor(paragraph, "sp");
    const isTitle = !!shape && titleShapes.includes(shape);
    if (isTitle) continue;
    const txBody = ancestor(paragraph, "txBody");
    const ownStyles = readLevels(txBody ? child(txBody, "lstStyle") : null);
    const pPr = child(paragraph, "pPr");
    const level = Math.min(
      MAX_LEVEL,
      Math.max(0, Number(pPr?.getAttribute("lvl") ?? 0)),
    );
    const style = { ...(mergeLevels(levels, ownStyles)[level] ?? {}), ...readBullet(pPr) };

    let bullet: string | undefined;
    if (!isTitle) {
      if (style.glyph) {
        bullet = style.glyph;
      } else if (style.numbering) {
        const next = (counters.get(level) ?? (style.start ?? 1) - 1) + 1;
        counters.set(level, next);
        for (const key of counters.keys()) if (key > level) counters.delete(key);
        bullet = listNumber(next, style.numbering);
      }
    }
    paragraphs.push({ text, level, bullet });
  }

  if (!title && paragraphs.length > 0) {
    title = paragraphs[0].text;
    paragraphs.shift();
  }

  return {
    title,
    paragraphs,
    hidden: slide.getAttribute("show") === "0",
  };
}

function notesFromXml(xml: string | null): string {
  if (!xml) return "";
  const doc = parseXml(xml);
  if (!doc) return "";

  for (const shape of byLocal(doc, "sp")) {
    const isBody = byLocal(shape, "ph").some(
      (ph) => (ph.getAttribute("type") ?? "") === "body",
    );
    if (!isBody) continue;
    const text = paragraphsOf(shape).join("\n").trim();
    if (text) return text;
  }

  // Some producers omit the placeholder type; fall back to every paragraph
  // except bare page numbers.
  return paragraphsOf(doc)
    .filter((text) => !/^\d+$/.test(text))
    .join("\n")
    .trim();
}

async function notesForSlide(read: Reader, slidePath: string): Promise<string> {
  const rels = await relationships(read, slidePath);
  const notesRel = findRelationship(rels, "/notesSlide");
  if (!notesRel) return "";
  const notesXml = await read(resolvePart(directoryOf(slidePath), notesRel.target));
  return notesFromXml(notesXml);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Parse a PPTX/OOXML deck into ordered slides with text, bullets, and notes. */
export async function parsePptx(bytes: Uint8Array): Promise<ParsedPresentation> {
  let zip;
  try {
    // Media and embedded objects are never needed for text retrieval; the
    // guard never inflates them, so large pictures cannot exhaust memory.
    zip = await openSafeZip(bytes, {
      allowed: (path) => /\.(xml|rels)$/.test(path),
    });
  } catch (error) {
    if (error instanceof ZipTooLarge) throw error;
    throw new Error(`Could not open this PowerPoint file. ${errorMessage(error)}`);
  }
  const read: Reader = (path) => zip.read(path);

  const presentationXml = await read("ppt/presentation.xml");
  const relsXml = await read("ppt/_rels/presentation.xml.rels");
  let slidePaths: string[] = [];

  if (presentationXml && relsXml) {
    const presentation = parseXml(presentationXml);
    const rels = parseXml(relsXml);
    if (presentation && rels) {
      const targets = new Map<string, string>();
      for (const rel of byLocal(rels, "Relationship")) {
        const id = rel.getAttribute("Id");
        const target = rel.getAttribute("Target");
        if (id && target) targets.set(id, target);
      }
      for (const sldId of byLocal(presentation, "sldId")) {
        const id = relId(sldId);
        const target = id ? targets.get(id) : undefined;
        if (target) slidePaths.push(resolvePart("ppt", target));
      }
    }
  }

  // Fall back to numeric slide filenames when the presentation manifest is
  // missing or does not expose a usable slide list.
  if (slidePaths.length === 0) {
    slidePaths = zip
      .paths()
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
      .sort((a, b) => slideNumber(a) - slideNumber(b));
  }

  if (slidePaths.length === 0) {
    throw new Error("No slides were found in this PowerPoint file.");
  }

  const truncated = slidePaths.length > MAX_SLIDES;
  const paths = truncated ? slidePaths.slice(0, MAX_SLIDES) : slidePaths;
  const presentationRoot = presentationXml
    ? (parseXml(presentationXml)?.documentElement ?? null)
    : null;
  const slides: ParsedSlide[] = [];

  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    const xml = await read(path);
    const doc = xml ? parseXml(xml) : null;
    const levels = await inheritedLevels(read, presentationRoot, path);
    const text = doc?.documentElement
      ? slideText(doc.documentElement, levels)
      : { title: "", paragraphs: [], hidden: false };
    slides.push({
      number: index + 1,
      title: text.title || `Slide ${index + 1}`,
      paragraphs: text.paragraphs,
      notes: await notesForSlide(read, path),
      hidden: text.hidden,
    });
  }

  const hiddenCount = slides.filter((slide) => slide.hidden).length;
  const notices: string[] = [];
  if (truncated) {
    notices.push(`Showing the first ${MAX_SLIDES.toLocaleString()} slides of this presentation.`);
  }
  if (hiddenCount > 0) {
    notices.push(
      `${hiddenCount} hidden ${hiddenCount === 1 ? "slide is" : "slides are"} included for reference.`,
    );
  }

  return {
    slides,
    format: "pptx",
    notice: notices.length ? notices.join(" ") : undefined,
  };
}

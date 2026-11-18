import type { PdfSearchHit, PdfSearchProgress } from "../types";

export function normalizePdfText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function textFromItems(items: ReadonlyArray<unknown>): string {
  let result = "";
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const { str, hasEOL } = item as { str?: unknown; hasEOL?: unknown };
    if (typeof str !== "string") continue;
    result += str;
    if (hasEOL) result += "\n";
    else if (str && !str.endsWith(" ")) result += " ";
  }
  return result;
}

export function findHitsInText(text: string, query: string, page: number, limit = 25): PdfSearchHit[] {
  const needle = normalizePdfText(query).toLowerCase();
  if (!needle) return [];
  const haystack = normalizePdfText(text);
  if (!haystack) return [];

  const lower = haystack.toLowerCase();
  const hits: PdfSearchHit[] = [];
  let index = lower.indexOf(needle);

  while (index !== -1 && hits.length < limit) {
    const start = Math.max(0, index - 58);
    const end = Math.min(haystack.length, index + needle.length + 82);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < haystack.length ? "…" : "";
    hits.push({
      page,
      offset: index,
      snippet: `${prefix}${haystack.slice(start, end)}${suffix}`,
    });
    index = lower.indexOf(needle, index + Math.max(1, needle.length));
  }

  return hits;
}

export interface SearchablePdf {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{ items: ReadonlyArray<unknown> }>;
  }>;
}

export async function searchPdfDocument(
  pdf: SearchablePdf,
  query: string,
  onProgress?: (progress: PdfSearchProgress) => void,
  isCancelled?: () => boolean,
): Promise<PdfSearchHit[]> {
  const hits: PdfSearchHit[] = [];
  for (let page = 1; page <= pdf.numPages; page += 1) {
    if (isCancelled?.()) return hits;
    onProgress?.({ page, total: pdf.numPages });
    const pdfPage = await pdf.getPage(page);
    const content = await pdfPage.getTextContent();
    hits.push(...findHitsInText(textFromItems(content.items), query, page));
    // Yield so the UI can paint progress and page navigation stays responsive.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  return hits;
}

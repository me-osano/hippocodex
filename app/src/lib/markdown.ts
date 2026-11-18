export interface MarkdownHeading {
  depth: number;
  text: string;
  id: string;
}

export function slugifyHeading(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~[\]()#>!]/g, "")
    .replace(/&[a-z]+;/gi, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Remove a leading YAML frontmatter block without touching later rules. */
export function stripFrontmatter(markdown: string): string {
  const match = markdown.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  return match ? markdown.slice(match[0].length) : markdown;
}

function headingText(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\\([\\`*{}[\]()#+\-.!_>])/g, "$1")
    .trim();
}

/** Collect ATX and setext headings outside fenced code blocks. */
export function extractHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const seen = new Map<string, number>();
  let fence: string | null = null;
  let previousLine: string | null = null;
  let previousWasHeading = false;

  const push = (depth: number, raw: string) => {
    const text = headingText(raw);
    if (!text) return;
    const base = slugifyHeading(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({ depth, text, id: count === 0 ? base : `${base}-${count}` });
  };

  for (const line of stripFrontmatter(markdown).split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) {
        fence = fenceMatch[1][0];
      } else if (fenceMatch[1][0] === fence) {
        fence = null;
      }
      previousLine = null;
      previousWasHeading = false;
      continue;
    }
    if (fence) continue;

    const setext = line.match(/^\s{0,3}(=+|-+)\s*$/);
    if (setext) {
      if (previousLine !== null && !previousWasHeading && previousLine.trim()) {
        push(setext[1][0] === "=" ? 1 : 2, previousLine);
        previousWasHeading = true;
      }
      previousLine = null;
      continue;
    }

    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (match) {
      push(match[1].length, match[2]);
      previousWasHeading = true;
      previousLine = line;
      continue;
    }

    previousWasHeading = false;
    previousLine = line;
  }

  return headings;
}

export function firstHeading(markdown: string): string | undefined {
  return extractHeadings(stripFrontmatter(markdown))[0]?.text;
}

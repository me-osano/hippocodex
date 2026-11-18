import { describe, expect, it } from "vitest";
import { extractHeadings, slugifyHeading, stripFrontmatter } from "./markdown";

describe("slugifyHeading", () => {
  it("produces stable, readable ids", () => {
    expect(slugifyHeading("Hello, World!")).toBe("hello-world");
    expect(slugifyHeading("Café & crème")).toBe("café-crème");
    expect(slugifyHeading("  Multiple   spaces  ")).toBe("multiple-spaces");
  });
});

describe("extractHeadings", () => {
  it("collects ATX headings and ignores fenced code", () => {
    const markdown = [
      "# Title",
      "",
      "Some text.",
      "",
      "## Section one",
      "",
      "```md",
      "# Not a heading",
      "```",
      "",
      "### Subsection",
      "## Section two",
    ].join("\n");

    expect(extractHeadings(markdown)).toEqual([
      { depth: 1, text: "Title", id: "title" },
      { depth: 2, text: "Section one", id: "section-one" },
      { depth: 3, text: "Subsection", id: "subsection" },
      { depth: 2, text: "Section two", id: "section-two" },
    ]);
  });

  it("deduplicates repeated heading ids", () => {
    expect(extractHeadings("# Notes\n# Notes\n## Notes").map((heading) => heading.id)).toEqual([
      "notes",
      "notes-1",
      "notes-2",
    ]);
  });

  it("strips inline markdown from headings", () => {
    const headings = extractHeadings("## **Bold** and `code` and [link](https://example.com)");
    expect(headings[0].text).toBe("Bold and code and link");
    expect(headings[0].id).toBe("bold-and-code-and-link");
  });

  it("collects setext headings", () => {
    const headings = extractHeadings("Title\n=====\n\nSection\n-------\n\nText");
    expect(headings).toEqual([
      { depth: 1, text: "Title", id: "title" },
      { depth: 2, text: "Section", id: "section" },
    ]);
  });

  it("ignores a YAML frontmatter block", () => {
    const markdown = "---\ntitle: Memory systems\n---\n\n# Real heading";
    expect(extractHeadings(markdown)).toEqual([{ depth: 1, text: "Real heading", id: "real-heading" }]);
  });
});

describe("stripFrontmatter", () => {
  it("removes only a leading frontmatter block", () => {
    expect(stripFrontmatter("---\ntitle: Notes\n---\n# Heading")).toBe("# Heading");
    expect(stripFrontmatter("# Heading\n\n---\n\nText")).toBe("# Heading\n\n---\n\nText");
    expect(stripFrontmatter("---\nnot closed\n# Heading")).toBe("---\nnot closed\n# Heading");
  });
});

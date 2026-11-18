import { describe, expect, it } from "vitest";
import { bulletGlyph, listNumber } from "./bullets";

describe("bulletGlyph", () => {
  it("maps symbol-font characters to visible Unicode", () => {
    expect(bulletGlyph("ü", "Wingdings")).toBe("✓");
    expect(bulletGlyph("\uf0fc", "Wingdings")).toBe("✓");
    expect(bulletGlyph("·", "Symbol")).toBe("•");
    expect(bulletGlyph("→")).toBe("→");
  });
});

describe("listNumber", () => {
  it("follows OOXML numbering schemes", () => {
    expect(listNumber(3, "arabicPeriod")).toBe("3.");
    expect(listNumber(2, "alphaLcPeriod")).toBe("b.");
    expect(listNumber(27, "alphaUcParenR")).toBe("A)");
    expect(listNumber(4, "romanLcPeriod")).toBe("iv.");
    expect(listNumber(4, "romanUcParenR")).toBe("IV)");
  });
});

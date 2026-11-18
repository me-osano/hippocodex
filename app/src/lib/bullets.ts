/**
 * Bullet characters in OOXML are often set in a symbol font (Wingdings,
 * Symbol): the character code only means something in that font, which a
 * document viewer cannot assume is installed. Map the common ones to real
 * Unicode glyphs so a tick stays a tick instead of becoming "ü".
 */

const WINGDINGS: Record<string, string> = {
  l: "●",
  n: "■",
  o: "□",
  p: "□",
  q: "❑",
  r: "❒",
  s: "⬧",
  t: "⧫",
  u: "◆",
  v: "❖",
  w: "⬥",
  x: "⌧",
  "¨": "◻",
  "Ø": "➢",
  "Ù": "➢",
  "à": "➔",
  "è": "➔",
  "ð": "⇨",
  "ü": "✓",
  "û": "✗",
  "þ": "☑",
  "ý": "☒",
  "J": "☺",
  "¤": "◉",
  "¡": "○",
  "·": "•",
  "\u009f": "•",
};

const SYMBOL: Record<string, string> = {
  "·": "•",
  "¨": "♦",
  "®": "→",
  "Þ": "⇒",
  "-": "−",
};

/** The glyph to draw for `char` set in `font`. */
export function bulletGlyph(char: string, font?: string | null): string {
  const name = (font ?? "").toLowerCase();
  // Symbol fonts address special glyphs through the F0xx private-use block.
  const code = char.charCodeAt(0);
  const plain =
    (code & 0xff00) === 0xf000 ? String.fromCharCode(code & 0xff) : char;
  if (name.includes("wingdings") || name.includes("webdings")) {
    return WINGDINGS[plain] ?? "•";
  }
  if (name === "symbol") return SYMBOL[plain] ?? "•";
  return plain;
}

function roman(value: number): string {
  const table: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = value;
  let out = "";
  for (const [amount, glyph] of table) {
    while (remaining >= amount) {
      out += glyph;
      remaining -= amount;
    }
  }
  return out;
}

/** Render an auto-numbered bullet marker from its OOXML scheme. Schemes look
 * like `arabicPeriod`, `alphaLcPeriod`, `romanUcParenR`. */
export function listNumber(value: number, scheme: string): string {
  const type = scheme.toLowerCase();
  const close = type.includes("paren") ? ")" : ".";
  const upper = type.includes("uc");
  if (type.includes("roman")) {
    const marker = roman(Math.max(1, value)).toLowerCase();
    return `${upper ? marker.toUpperCase() : marker}${close}`;
  }
  if (type.includes("alpha")) {
    const letter = String.fromCharCode(96 + (((value - 1) % 26) + 1));
    return `${upper ? letter.toUpperCase() : letter}${close}`;
  }
  return `${value}${close}`;
}

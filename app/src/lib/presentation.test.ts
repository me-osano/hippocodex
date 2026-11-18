import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parsePresentation } from "./presentation";
import { parseLegacyPpt } from "./ppt";

const P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

function slideXml(title: string, body: string[]): string {
  const bodyParagraphs = body
    .map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="${P_NS}" xmlns:a="${A_NS}">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp><p:txBody>${bodyParagraphs}</p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;
}

function makeDeck(): JSZip {
  const zip = new JSZip();
  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="${P_NS}" xmlns:r="${R_NS}">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId2"/>
    <p:sldId id="257" r:id="rId3"/>
  </p:sldIdLst>
</p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="${PKG_REL_NS}">
  <Relationship Id="rId2" Type="${R_NS}/slide" Target="slides/slide2.xml"/>
  <Relationship Id="rId3" Type="${R_NS}/slide" Target="slides/slide1.xml"/>
</Relationships>`,
  );
  zip.file("ppt/slides/slide2.xml", slideXml("Alpha title", ["First bullet", "Second &amp; bullet"]));
  zip.file("ppt/slides/slide1.xml", slideXml("Beta title", ["Second slide body"]));
  zip.file(
    "ppt/slides/_rels/slide2.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="${PKG_REL_NS}">
  <Relationship Id="rId5" Type="${R_NS}/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
</Relationships>`,
  );
  zip.file(
    "ppt/notesSlides/notesSlide1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<p:notes xmlns:p="${P_NS}" xmlns:a="${A_NS}">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>1</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>Remember to mention citations.</a:t></a:r></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:notes>`,
  );
  return zip;
}

function record(type: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  out[0] = type & 0xff;
  out[1] = (type >> 8) & 0xff;
  out[4] = payload.length & 0xff;
  out[5] = (payload.length >> 8) & 0xff;
  out[6] = (payload.length >> 16) & 0xff;
  out[7] = (payload.length >>> 24) & 0xff;
  out.set(payload, 8);
  return out;
}

function beRecord(type: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  out[0] = (type >> 8) & 0xff;
  out[1] = type & 0xff;
  out[4] = (payload.length >>> 24) & 0xff;
  out[5] = (payload.length >> 16) & 0xff;
  out[6] = (payload.length >> 8) & 0xff;
  out[7] = payload.length & 0xff;
  out.set(payload, 8);
  return out;
}

function utf16le(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    out[index * 2] = text.charCodeAt(index) & 0xff;
    out[index * 2 + 1] = text.charCodeAt(index) >> 8;
  }
  return out;
}

function utf16be(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    out[index * 2] = text.charCodeAt(index) >> 8;
    out[index * 2 + 1] = text.charCodeAt(index) & 0xff;
  }
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function legacyBytes(): Uint8Array {
  const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  return concat(
    ole,
    record(0x03ee, new Uint8Array(24)),
    record(0x0fa0, utf16le("Quarterly results")),
    record(0x0fa8, new TextEncoder().encode("Legacy bullet")),
  );
}

describe("parsePresentation (PPTX)", () => {
  it("reads slides in manifest order with titles, text, and notes", async () => {
    const bytes = await makeDeck().generateAsync({ type: "uint8array" });
    const result = await parsePresentation(bytes, "pptx");

    expect(result.format).toBe("pptx");
    expect(result.slides).toHaveLength(2);
    expect(result.slides[0].title).toBe("Alpha title");
    expect(result.slides[0].paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "First bullet",
      "Second & bullet",
    ]);
    expect(result.slides[0].notes).toBe("Remember to mention citations.");
    expect(result.slides[1].title).toBe("Beta title");
    expect(result.slides[1].paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "Second slide body",
    ]);
    expect(result.slides[1].notes).toBe("");
  });

  it("falls back to numeric slide filenames without a manifest", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide2.xml", slideXml("Two", ["second"]));
    zip.file("ppt/slides/slide1.xml", slideXml("One", ["first"]));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const result = await parsePresentation(bytes, "pptx");

    expect(result.slides.map((slide) => slide.title)).toEqual(["One", "Two"]);
  });

  it("reports a clear error for a ZIP with no slides", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "not a deck");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await expect(parsePresentation(bytes, "pptx")).rejects.toThrow(/No slides/);
  });

  it("preserves bullets, nesting, and hidden slides from the deck", async () => {
    const zip = new JSZip();
    zip.file(
      "ppt/presentation.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="${P_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}">
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
  <p:defaultTextStyle>
    <a:lvl1pPr><a:buChar char="•"/></a:lvl1pPr>
    <a:lvl2pPr><a:buChar char="ü"/><a:buFont typeface="Wingdings"/></a:lvl2pPr>
  </p:defaultTextStyle>
</p:presentation>`,
    );
    zip.file(
      "ppt/_rels/presentation.xml.rels",
      `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="${PKG_REL_NS}">
  <Relationship Id="rId2" Type="${R_NS}/slide" Target="slides/slide1.xml"/>
</Relationships>`,
    );
    zip.file(
      "ppt/slides/slide1.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="${P_NS}" xmlns:a="${A_NS}" show="0"><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:txBody><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp>
  <p:sp><p:txBody>
    <a:p><a:r><a:t>First</a:t></a:r></a:p>
    <a:p><a:pPr lvl="1"/><a:r><a:t>Second</a:t></a:r></a:p>
    <a:p><a:pPr><a:buNone/></a:pPr><a:r><a:t>No bullet</a:t></a:r></a:p>
  </p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`,
    );

    const result = await parsePresentation(
      await zip.generateAsync({ type: "uint8array" }),
      "pptx",
    );

    expect(result.slides[0].hidden).toBe(true);
    expect(result.slides[0].title).toBe("Title");
    expect(result.slides[0].paragraphs).toEqual([
      { text: "First", level: 0, bullet: "•" },
      { text: "Second", level: 1, bullet: "✓" },
      { text: "No bullet", level: 0, bullet: undefined },
    ]);
    expect(result.notice).toContain("hidden");
  });

  it("inherits bullets through layout and master, including auto-numbering", async () => {
    const zip = new JSZip();
    zip.file(
      "ppt/presentation.xml",
      `<p:presentation xmlns:p="${P_NS}" xmlns:r="${R_NS}">
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
</p:presentation>`,
    );
    zip.file(
      "ppt/_rels/presentation.xml.rels",
      `<Relationships xmlns="${PKG_REL_NS}">
  <Relationship Id="rId2" Type="${R_NS}/slide" Target="slides/slide1.xml"/>
</Relationships>`,
    );
    zip.file(
      "ppt/slides/slide1.xml",
      `<p:sld xmlns:p="${P_NS}" xmlns:a="${A_NS}"><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:txBody><a:p><a:r><a:t>Inherited styles</a:t></a:r></a:p></p:txBody></p:sp>
  <p:sp><p:txBody>
    <a:p><a:r><a:t>Top level</a:t></a:r></a:p>
    <a:p><a:pPr lvl="1"/><a:r><a:t>Nested</a:t></a:r></a:p>
  </p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`,
    );
    zip.file(
      "ppt/slides/_rels/slide1.xml.rels",
      `<Relationships xmlns="${PKG_REL_NS}">
  <Relationship Id="rId6" Type="${R_NS}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`,
    );
    zip.file(
      "ppt/slideLayouts/slideLayout1.xml",
      `<p:sldLayout xmlns:p="${P_NS}" xmlns:a="${A_NS}"><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
    <p:txBody><a:lstStyle><a:lvl1pPr><a:buChar char="-"/></a:lvl1pPr></a:lstStyle></p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:sldLayout>`,
    );
    zip.file(
      "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      `<Relationships xmlns="${PKG_REL_NS}">
  <Relationship Id="rId1" Type="${R_NS}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
    );
    zip.file(
      "ppt/slideMasters/slideMaster1.xml",
      `<p:sldMaster xmlns:p="${P_NS}" xmlns:a="${A_NS}">
  <p:txStyles><p:bodyStyle>
    <a:lvl1pPr><a:buAutoNum type="romanPeriod"/></a:lvl1pPr>
    <a:lvl2pPr><a:buAutoNum type="arabicPeriod"/></a:lvl2pPr>
  </p:bodyStyle></p:txStyles>
</p:sldMaster>`,
    );

    const result = await parsePresentation(
      await zip.generateAsync({ type: "uint8array" }),
      "pptx",
    );
    const bullets = result.slides[0].paragraphs.map((paragraph) => paragraph.bullet);

    // The layout's explicit character wins at level 0; the master's
    // numbering fills in where the layout says nothing.
    expect(bullets).toEqual(["-", "1."]);
  });
});

describe("parsePresentation (legacy PPT)", () => {
  it("recovers text from binary records", async () => {
    const result = await parsePresentation(legacyBytes(), "ppt");

    expect(result.format).toBe("legacy");
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0].title).toBe("Quarterly results");
    expect(result.slides[0].paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "Quarterly results",
      "Legacy bullet",
    ]);
    expect(result.notice).toContain("Recovered text");
  });

  it("recovers big-endian UTF-16 text from an odd-length record", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const bytes = concat(
      ole,
      beRecord(0x03ee, new Uint8Array(24)),
      beRecord(0x0fa0, concat(utf16be("Renamed legacy deck"), new Uint8Array([0]))),
    );

    const result = await parsePresentation(bytes, "pptx");
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0].title).toBe("Renamed legacy deck");
    expect(result.notice).toContain("legacy binary PowerPoint container");
  });

  it("fails clearly when no text atoms are present", () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(() => parseLegacyPpt(ole, "ppt")).toThrow(/No recoverable text/);
  });
});

describe("parsePresentation (unrecognised container)", () => {
  it("rejects unknown bytes", async () => {
    await expect(
      parsePresentation(new TextEncoder().encode("not a presentation"), "pptx"),
    ).rejects.toThrow(/not a recognisable PowerPoint container/);
  });
});

import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseVisualPptx, type SlideElement } from "./parse";

const sample = () =>
  new Uint8Array(readFileSync("fixtures/sample.pptx"));

const texts = (elements: SlideElement[]): string[] =>
  elements.flatMap((element) =>
    element.kind === "shape" && element.text
      ? element.text.paras.map((paragraph) =>
          paragraph.runs.map((run) => run.text).join(""),
        )
      : [],
  );

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock") as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
});

describe("visual PPTX reader", () => {
  it("reads slide size, order, inherited geometry and text styling", async () => {
    const deck = await parseVisualPptx(sample());
    expect(deck.width).toBe(960);
    expect(deck.height).toBe(720);
    expect(deck.slides).toHaveLength(3);
    expect(texts(deck.slides[0].elements)).toContain("Quarterly Review");

    const title = deck.slides[0].elements.find((element) =>
      texts([element]).includes("Quarterly Review"),
    );
    expect(title?.kind).toBe("shape");
    if (title?.kind !== "shape") return;
    expect(title.w).toBeGreaterThan(400);
    expect(title.text?.paras[0].align).toBe("center");
    expect(title.text?.paras[0].runs[0].size).toBeGreaterThan(40);

    const box = deck.slides[1].elements.find((element) =>
      texts([element]).includes("Green box"),
    );
    if (box?.kind !== "shape") throw new Error("green box missing");
    expect(box.fill).toBe("rgb(31, 138, 76)");
    expect(box.text?.paras[0].runs[0].bold).toBe(true);
  });

  it("keeps bullets, table cells and speaker notes", async () => {
    const deck = await parseVisualPptx(sample());
    const body = deck.slides[1].elements.find((element) =>
      texts([element]).includes("Churn down"),
    );
    if (body?.kind !== "shape") throw new Error("body missing");
    expect(body.text?.paras[1].level).toBe(1);
    expect(body.text?.paras[0].bullet).toBeTruthy();

    const slide = deck.slides[2];
    const table = slide.elements.find((element) => element.kind === "table");
    if (table?.kind !== "table") throw new Error("table missing");
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1].cells[1].text.paras[0].runs[0].text).toBe("R2C2");
    expect(slide.notes).toBe("Speaker note text");
  });

  it("marks hidden slides so the slide show can pass them over", async () => {
    const zip = await JSZip.loadAsync(sample());
    const part = "ppt/slides/slide2.xml";
    const xml = await zip.file(part)?.async("string");
    expect(xml).toContain("<p:sld ");
    zip.file(part, xml?.replace("<p:sld ", '<p:sld show="0" ') ?? "");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const deck = await parseVisualPptx(bytes);
    expect(deck.slides.map((slide) => !!slide.hidden)).toEqual([false, true, false]);
  });

  it("reads cached chart values without opening an embedded workbook", async () => {
    const deck = await parseVisualPptx(
      new Uint8Array(readFileSync("fixtures/viewer-regressions/charts.pptx")),
    );
    const chart = deck.slides[0].elements.find((element) => element.kind === "chart");
    if (chart?.kind !== "chart") throw new Error("chart missing");
    if (chart.chart.kind !== "cartesian") throw new Error("wrong chart kind");
    expect(chart.chart.categories).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(chart.chart.series[0].values).toEqual([120, 150, 170, 210]);
    deck.dispose();
  });

  it("detects right-to-left paragraphs from their text", async () => {
    const deck = await parseVisualPptx(
      new Uint8Array(readFileSync("fixtures/viewer-regressions/rtl.pptx")),
    );
    const rtl = deck.slides.some((slide) =>
      slide.elements.some(
        (element) =>
          element.kind === "shape" &&
          element.text?.paras.some((paragraph) => paragraph.rtl),
      ),
    );
    expect(rtl).toBe(true);
    deck.dispose();
  });
});

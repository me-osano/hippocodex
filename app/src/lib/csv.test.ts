import { describe, expect, it } from "vitest";
import { delimiterName, parseTable, sortRows } from "./csv";

describe("parseTable", () => {
  it("parses comma-separated data and pads short rows", () => {
    const table = parseTable("name,score\nAda,10\nGrace,9,extra\n");
    expect(table.delimiter).toBe(",");
    expect(table.columns).toBe(3);
    expect(table.rows).toEqual([
      ["name", "score", ""],
      ["Ada", "10", ""],
      ["Grace", "9", "extra"],
    ]);
  });

  it("detects tabs and strips a BOM", () => {
    const table = parseTable("\uFEFFa\tb\n1\t2\n");
    expect(table.delimiter).toBe("\t");
    expect(table.rows[0]).toEqual(["a", "b"]);
  });

  it("limits very large previews", () => {
    const source = ["a,b", ...Array.from({ length: 20 }, (_, index) => `${index},x`)].join("\n");
    const table = parseTable(source, 5);
    expect(table.truncated).toBe(true);
    expect(table.rows).toHaveLength(5);
  });
});

describe("sortRows", () => {
  const rows = [
    ["Ada", "10"],
    ["Grace", "2"],
    ["Linus", "30"],
  ];

  it("sorts numerically when both cells are numbers", () => {
    expect(sortRows(rows, 1, "asc").map((row) => row[0])).toEqual(["Grace", "Ada", "Linus"]);
    expect(sortRows(rows, 1, "desc").map((row) => row[0])).toEqual(["Linus", "Ada", "Grace"]);
  });

  it("sorts text naturally", () => {
    expect(sortRows(rows, 0, "asc").map((row) => row[0])).toEqual(["Ada", "Grace", "Linus"]);
  });
});

it("names delimiters", () => {
  expect(delimiterName(",")).toBe("comma");
  expect(delimiterName("\t")).toBe("tab");
  expect(delimiterName(";")).toBe("semicolon");
});

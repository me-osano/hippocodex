import Papa from "papaparse";

export interface ParsedTable {
  rows: string[][];
  delimiter: string;
  columns: number;
  truncated: boolean;
}

export const MAX_TABLE_ROWS = 5000;

export function parseTable(text: string, maxRows = MAX_TABLE_ROWS): ParsedTable {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });

  const rows = (result.data || []).map((row) =>
    (Array.isArray(row) ? row : [String(row)]).map((cell) => (cell == null ? "" : String(cell))),
  );
  const truncated = rows.length > maxRows;
  const visible = truncated ? rows.slice(0, maxRows) : rows;
  const columns = visible.reduce((max, row) => Math.max(max, row.length), 0);
  const normalized = visible.map((row) => {
    if (row.length === columns) return row;
    return [...row, ...Array.from({ length: columns - row.length }, () => "")];
  });

  return {
    rows: normalized,
    delimiter: result.meta.delimiter || ",",
    columns,
    truncated,
  };
}

export function delimiterName(delimiter: string): string {
  switch (delimiter) {
    case ",":
      return "comma";
    case "\t":
      return "tab";
    case ";":
      return "semicolon";
    case "|":
      return "pipe";
    default:
      return `“${delimiter}”`;
  }
}

export function sortRows(rows: string[][], column: number, direction: "asc" | "desc"): string[][] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[column] ?? "";
    const right = b[column] ?? "";
    const leftNumber = Number(left.replace(/[%,$\s]/g, ""));
    const rightNumber = Number(right.replace(/[%,$\s]/g, ""));
    if (left.trim() !== "" && right.trim() !== "" && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return (leftNumber - rightNumber) * factor;
    }
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }) * factor;
  });
}

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import type { OpenDocument } from "../types";
import { formatBytes } from "../lib/format";
import { sortRows } from "../lib/csv";
import { IconChevronDown, IconSearch, IconTable } from "./Icons";

interface ExcelViewerProps {
  doc: OpenDocument;
}

const PAGE_SIZE = 250;
const MAX_ROWS = 5000;

interface ParsedSheet {
  rows: string[][];
  columns: number;
  truncated: boolean;
}

function parseSheet(workbook: XLSX.WorkBook, name: string): ParsedSheet {
  const sheet = workbook.Sheets[name];
  if (!sheet) return { rows: [], columns: 0, truncated: false };

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  const rows = rawRows.map((row) =>
    row.map((cell) => (cell == null ? "" : String(cell))),
  );
  const truncated = rows.length > MAX_ROWS;
  const visible = truncated ? rows.slice(0, MAX_ROWS) : rows;
  const columns = visible.reduce((max, row) => Math.max(max, row.length), 0);

  return {
    rows: visible.map((row) =>
      row.length === columns
        ? row
        : [...row, ...Array.from({ length: columns - row.length }, () => "")],
    ),
    columns,
    truncated,
  };
}

export default function ExcelViewer({ doc }: ExcelViewerProps) {
  const workbook = useMemo(
    () => XLSX.read(doc.bytes, { type: "array", cellDates: true }),
    [doc.bytes],
  );
  const [sheetIndex, setSheetIndex] = useState(0);
  const [filter, setFilter] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [sort, setSort] = useState<{ column: number; direction: "asc" | "desc" } | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setSheetIndex(0);
    setFilter("");
    setHasHeader(true);
    setSort(null);
    setVisibleCount(PAGE_SIZE);
  }, [doc.id]);

  const sheetName = workbook.SheetNames[sheetIndex] ?? workbook.SheetNames[0] ?? "";
  const table = useMemo(() => parseSheet(workbook, sheetName), [workbook, sheetName]);
  const header = hasHeader ? table.rows[0] : null;
  const headerCells = header ?? Array.from({ length: table.columns }, (_, index) => `Column ${index + 1}`);
  const body = useMemo(() => (hasHeader ? table.rows.slice(1) : table.rows), [table.rows, hasHeader]);
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return body;
    return body.filter((row) => row.some((cell) => cell.toLowerCase().includes(query)));
  }, [body, filter]);
  const sorted = useMemo(
    () => (sort ? sortRows(filtered, sort.column, sort.direction) : filtered),
    [filtered, sort],
  );
  const visible = sorted.slice(0, visibleCount);

  const toggleSort = (column: number) => {
    if (!hasHeader) return;
    setSort((current) => {
      if (!current || current.column !== column) return { column, direction: "asc" };
      if (current.direction === "asc") return { column, direction: "desc" };
      return null;
    });
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="csv-viewer">
      <div className="viewer-toolbar csv-toolbar">
        <span className="file-kind-chip">
          <IconTable size={14} />
          Excel workbook
        </span>
        <span className="toolbar-meta">
          {table.rows.length.toLocaleString()} rows · {table.columns} columns · {formatBytes(doc.size)}
        </span>
        <div className="search-field csv-filter">
          <IconSearch size={15} />
          <input
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="Filter rows"
            aria-label="Filter rows"
          />
          {filter && (
            <button type="button" className="search-clear" onClick={() => setFilter("")} aria-label="Clear filter">
              ×
            </button>
          )}
        </div>
        <button
          className={`toggle-chip ${hasHeader ? "is-active" : ""}`}
          onClick={() => {
            setHasHeader((value) => !value);
            setSort(null);
          }}
          aria-pressed={hasHeader}
          title="Use the first row as column headers"
        >
          First row is header
        </button>
        {table.truncated && (
          <span className="toolbar-warning" title={`Only the first ${MAX_ROWS.toLocaleString()} rows are loaded`}>
            Preview limited to {MAX_ROWS.toLocaleString()} rows
          </span>
        )}
      </div>

      <div className="excel-sheets" role="tablist" aria-label="Workbook sheets">
        {workbook.SheetNames.map((name, index) => (
          <button
            key={name}
            className={index === sheetIndex ? "is-active" : ""}
            onClick={() => {
              setSheetIndex(index);
              setFilter("");
              setSort(null);
              setVisibleCount(PAGE_SIZE);
            }}
            role="tab"
            aria-selected={index === sheetIndex}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="csv-scroll">
        {table.rows.length === 0 ? (
          <div className="viewer-status">
            <p>This sheet is empty.</p>
          </div>
        ) : (
          <table className="csv-table">
            <thead>
              <tr>
                <th className="row-number" aria-label="Row number" />
                {headerCells.map((cell, column) => (
                  <th
                    key={column}
                    scope="col"
                    aria-sort={
                      sort?.column === column
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    {hasHeader ? (
                      <button className="csv-sort" onClick={() => toggleSort(column)}>
                        <span>{cell || `Column ${column + 1}`}</span>
                        <IconChevronDown
                          size={13}
                          className={
                            sort?.column === column
                              ? sort.direction === "asc"
                                ? "is-asc"
                                : "is-desc"
                              : ""
                          }
                        />
                      </button>
                    ) : (
                      <span className="csv-column-name">Column {column + 1}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th className="row-number" scope="row">
                    {rowIndex + 1}
                  </th>
                  {row.map((cell, column) => (
                    <td key={column} title={cell}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {visible.length === 0 && table.rows.length > 0 && (
          <div className="csv-empty">No rows match “{filter}”.</div>
        )}
        {sorted.length > visible.length && (
          <div className="csv-more">
            <span>
              Showing {visible.length.toLocaleString()} of {sorted.length.toLocaleString()} rows
            </span>
            <button className="btn-secondary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              Show more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

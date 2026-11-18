import { useMemo, useState } from "react";
import type { OpenDocument } from "../types";
import { decodeUtf8 } from "../lib/text";
import { delimiterName, parseTable, sortRows } from "../lib/csv";
import { formatBytes } from "../lib/format";
import { IconChevronDown, IconSearch, IconTable } from "./Icons";

interface CsvViewerProps {
  doc: OpenDocument;
}

const PAGE_SIZE = 250;

export default function CsvViewer({ doc }: CsvViewerProps) {
  const text = useMemo(() => decodeUtf8(doc.bytes), [doc.bytes]);
  const table = useMemo(() => parseTable(text), [text]);
  const [filter, setFilter] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [sort, setSort] = useState<{ column: number; direction: "asc" | "desc" } | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const header = hasHeader ? table.rows[0] : null;
  const columnCount = table.columns;
  const headerCells =
    header ?? Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
  const body = useMemo(() => (hasHeader ? table.rows.slice(1) : table.rows), [table.rows, hasHeader]);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return body;
    return body.filter((row) => row.some((cell) => cell.toLowerCase().includes(query)));
  }, [body, filter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    return sortRows(filtered, sort.column, sort.direction);
  }, [filtered, sort]);

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
          {delimiterName(table.delimiter)}-separated
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
            <button
              type="button"
              className="search-clear"
              onClick={() => setFilter("")}
              aria-label="Clear filter"
            >
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
          <span className="toolbar-warning" title="Only the first 5,000 rows are loaded">
            Preview limited to 5,000 rows
          </span>
        )}
      </div>

      <div className="csv-scroll">
        {table.rows.length === 0 ? (
          <div className="viewer-status">
            <p>This table is empty.</p>
          </div>
        ) : (
          <table className="csv-table">
            <thead>
              <tr>
                <th className="row-number" aria-label="Row number" />
                {(columnCount > 0 ? headerCells : table.rows[0]).map((cell, column) => (
                  <th key={column} scope="col" aria-sort={sort?.column === column ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    {hasHeader ? (
                      <button className="csv-sort" onClick={() => toggleSort(column)}>
                        <span>{cell || `Column ${column + 1}`}</span>
                        <IconChevronDown
                          size={13}
                          className={sort?.column === column ? (sort.direction === "asc" ? "is-asc" : "is-desc") : ""}
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

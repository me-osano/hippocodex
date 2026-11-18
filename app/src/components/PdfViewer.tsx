import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { GlobalWorkerOptions, TextLayer, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { OpenDocument, OutlineEntry, PdfSearchHit, PdfSearchProgress } from "../types";
import { clamp } from "../lib/format";
import { searchPdfDocument } from "../lib/pdfSearch";
import { openExternal } from "../platform/external";
import {
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
  IconFitWidth,
  IconList,
  IconSearch,
  IconZoomIn,
  IconZoomOut,
} from "./Icons";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  doc: OpenDocument;
  onToast: (message: string, tone?: "info" | "error") => void;
}

interface PageSize {
  width: number;
  height: number;
}

const DEFAULT_PAGE: PageSize = { width: 612, height: 792 };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Snippet({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query.trim())})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.trim().toLowerCase() ? <mark key={index}>{part}</mark> : part,
      )}
    </>
  );
}

function OutlineList({
  items,
  depth = 0,
  onGo,
}: {
  items: OutlineEntry[];
  depth?: number;
  onGo: (dest: unknown) => void;
}) {
  return (
    <ul className="outline-list" style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`}>
          <button className="outline-item" onClick={() => onGo(item.dest)} title={item.title}>
            <span className="outline-bullet" aria-hidden="true" />
            <span>{item.title}</span>
          </button>
          {item.items?.length > 0 && <OutlineList items={item.items} depth={depth + 1} onGo={onGo} />}
        </li>
      ))}
    </ul>
  );
}

interface PdfPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  estimatedHeight: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  searchQuery: string;
  onDest: (dest: unknown) => void;
  onError: (message: string) => void;
  onToast: (message: string, tone?: "info" | "error") => void;
}

const PdfPage = memo(function PdfPage({
  pdf,
  pageNumber,
  scale,
  estimatedHeight,
  scrollRef,
  searchQuery,
  onDest,
  onError,
  onToast,
}: PdfPageProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);
  const textDivsRef = useRef<HTMLElement[]>([]);
  const queryRef = useRef(searchQuery);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);

  queryRef.current = searchQuery;

  useEffect(() => {
    const node = slotRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRef.current, rootMargin: "1400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [scrollRef]);

  useEffect(() => {
    const textDivs = textDivsRef.current;
    const query = searchQuery.trim().toLowerCase();
    for (const div of textDivs) {
      div.classList.toggle("pdf-hit", Boolean(query) && Boolean(div.textContent?.toLowerCase().includes(query)));
    }
  }, [searchQuery, rendered]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let textLayer: TextLayer | undefined;

    const pageNode = pageRef.current;
    const canvas = canvasRef.current;
    const textHost = textRef.current;
    const linkHost = linkRef.current;
    if (!pageNode || !canvas || !textHost || !linkHost) return;

    const run = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        pageNode.style.width = `${viewport.width}px`;
        pageNode.style.height = `${viewport.height}px`;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Could not create a drawing context.");
        context.save();
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.restore();

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        });
        await renderTask.promise;
        if (cancelled) return;

        const textContent = await page.getTextContent();
        if (cancelled) return;
        textHost.replaceChildren();
        textHost.style.setProperty("--total-scale-factor", String(viewport.scale));
        textHost.style.setProperty("--scale-round-x", "1px");
        textHost.style.setProperty("--scale-round-y", "1px");
        textLayer = new TextLayer({ textContentSource: textContent, container: textHost, viewport });
        await textLayer.render();
        if (cancelled) return;
        textDivsRef.current = textLayer.textDivs;
        const query = queryRef.current.trim().toLowerCase();
        if (query) {
          for (const div of textLayer.textDivs) {
            if (div.textContent?.toLowerCase().includes(query)) div.classList.add("pdf-hit");
          }
        }

        const annotations = await page.getAnnotations({ intent: "display" });
        if (cancelled) return;
        linkHost.replaceChildren();
        for (const annotation of annotations) {
          if (annotation?.subtype !== "Link" || !Array.isArray(annotation.rect)) continue;
          const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(annotation.rect) as number[];
          const left = Math.min(x1, x2);
          const top = Math.min(y1, y2);
          const width = Math.abs(x2 - x1);
          const height = Math.abs(y2 - y1);
          if (width < 1 || height < 1) continue;

          if (typeof annotation.url === "string" && annotation.url) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "pdf-link";
            button.title = annotation.url;
            button.setAttribute("aria-label", `Open link: ${annotation.url}`);
            button.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
            button.addEventListener("click", () => {
              void openExternal(annotation.url as string).catch(() =>
                onToast("This link could not be opened.", "error"),
              );
            });
            linkHost.append(button);
          } else if (annotation.dest) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "pdf-link";
            button.title = "Go to linked passage";
            button.setAttribute("aria-label", "Go to linked passage");
            button.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
            button.addEventListener("click", () => onDest(annotation.dest));
            linkHost.append(button);
          }
        }

        setRendered(true);
        setFailed(false);
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "RenderingCancelledException") return;
        setFailed(true);
        onError(`Page ${pageNumber} could not be fully rendered.`);
      }
    };

    void run();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // The task may already have finished.
      }
      try {
        textLayer?.cancel();
      } catch {
        // The layer may already have finished.
      }
    };
  }, [pdf, pageNumber, scale, visible, onDest, onError, onToast]);

  return (
    <div className="pdf-page-slot" ref={slotRef} style={{ minHeight: estimatedHeight }}>
      <div
        className={`pdf-page ${rendered ? "is-ready" : ""} ${failed ? "has-error" : ""}`}
        ref={pageRef}
        data-page-number={pageNumber}
      >
        <canvas ref={canvasRef} aria-label={`Page ${pageNumber}`} />
        <div className="pdf-link-layer" ref={linkRef} />
        <div className="textLayer pdf-text-layer" ref={textRef} />
        {!rendered && !failed && (
          <div className="pdf-page-placeholder" aria-hidden="true">
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        )}
        {failed && (
          <div className="pdf-page-failure">
            <IconAlert size={20} />
            <span>Page {pageNumber} could not be rendered.</span>
          </div>
        )}
        <span className="pdf-page-number" aria-hidden="true">
          {pageNumber}
        </span>
      </div>
    </div>
  );
});

export default function PdfViewer({ doc, onToast }: PdfViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoomMode, setZoomMode] = useState<"fit" | "custom">("fit");
  const [customScale, setCustomScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pane, setPane] = useState<"outline" | "search" | null>(null);
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [metadata, setMetadata] = useState<{ title?: string; author?: string }>({});
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hits, setHits] = useState<PdfSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<PdfSearchProgress | null>(null);
  const [searchedOnce, setSearchedOnce] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const pageInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToken = useRef(0);
  const pageRef = useRef(1);

  const fitScale = useMemo(() => {
    if (containerWidth <= 0) return 1;
    return clamp((containerWidth - 64) / pageSize.width, 0.25, 4);
  }, [containerWidth, pageSize.width]);

  const scale = zoomMode === "fit" ? fitScale : customScale;
  pageRef.current = currentPage;

  const handlePageError = useCallback(
    (message: string) => {
      onToast(message, "error");
    },
    [onToast],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setPdf(null);
    setPageCount(0);
    setOutline([]);
    setMetadata({});
    setCurrentPage(1);
    setPageInput("1");
    setZoomMode("fit");
    setPane(null);
    setSearchQuery("");
    setSearchInput("");
    setHits([]);
    setSearchedOnce(false);
    pageRefs.current.clear();

    const task = getDocument({
      data: doc.bytes.slice(),
      useSystemFonts: true,
    });

    task.promise
      .then(async (loaded) => {
        if (cancelled) {
          void loaded.destroy();
          return;
        }
        setPdf(loaded);
        setPageCount(loaded.numPages);

        const [firstPage, outlineResult, metadataResult] = await Promise.all([
          loaded.getPage(1),
          loaded.getOutline().catch(() => null),
          loaded.getMetadata().catch(() => null),
        ]);
        if (cancelled) return;

        const viewport = firstPage.getViewport({ scale: 1 });
        setPageSize({ width: viewport.width, height: viewport.height });
        setOutline((outlineResult as OutlineEntry[] | null) ?? []);
        const info = (metadataResult?.info ?? {}) as Record<string, unknown>;
        setMetadata({
          title: typeof info.Title === "string" && info.Title.trim() ? info.Title.trim() : undefined,
          author: typeof info.Author === "string" && info.Author.trim() ? info.Author.trim() : undefined,
        });
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "PasswordException") {
          setLoadError("This PDF is password protected. Opening protected documents is not supported yet.");
        } else if (name === "InvalidPDFException") {
          setLoadError("This file does not appear to be a valid PDF.");
        } else {
          setLoadError(error instanceof Error ? error.message : "The PDF could not be opened.");
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
      searchToken.current += 1;
      void task.destroy();
    };
  }, [doc.id, doc.bytes, reloadKey]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setContainerWidth(node.clientWidth));
    observer.observe(node);
    setContainerWidth(node.clientWidth);
    return () => observer.disconnect();
  }, [loading]);

  const jumpToPage = useCallback(
    (page: number) => {
      const target = clamp(Math.round(page), 1, Math.max(1, pageCount));
      const node = pageRefs.current.get(target);
      if (node && scrollRef.current) {
        scrollRef.current.scrollTo({ top: Math.max(0, node.offsetTop - 16), behavior: "smooth" });
      }
      setCurrentPage(target);
      setPageInput(String(target));
    },
    [pageCount],
  );

  useEffect(() => {
    if (document.activeElement !== pageInputRef.current) setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const marker = node.scrollTop + 120;
      let detected = 1;
      for (let page = 1; page <= pageCount; page += 1) {
        const element = pageRefs.current.get(page);
        if (!element) continue;
        if (element.offsetTop <= marker) detected = page;
        else break;
      }
      setCurrentPage((existing) => (existing === detected ? existing : detected));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      node.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pageCount, loading]);

  useEffect(() => {
    if (pane === "search") {
      window.setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [pane]);

  const goToDest = useCallback(
    async (dest: unknown) => {
      if (!pdf) return;
      let target = dest;
      if (typeof target === "string") {
        try {
          target = await pdf.getDestination(target);
        } catch {
          return;
        }
      }
      if (!Array.isArray(target) || target.length === 0) return;
      const pageRefValue: unknown = target[0];
      let pageIndex: number | null = null;
      if (typeof pageRefValue === "number") {
        pageIndex = pageRefValue;
      } else if (pageRefValue && typeof pageRefValue === "object") {
        try {
          pageIndex = await pdf.getPageIndex(pageRefValue as never);
        } catch {
          pageIndex = null;
        }
      }
      if (pageIndex !== null && pageIndex >= 0 && pageIndex < pdf.numPages) jumpToPage(pageIndex + 1);
    },
    [pdf, jumpToPage],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      setZoomMode("custom");
      setCustomScale(clamp((zoomMode === "fit" ? fitScale : customScale) * factor, 0.25, 5));
    },
    [zoomMode, fitScale, customScale],
  );

  const runSearch = useCallback(async () => {
    const query = searchInput.trim();
    if (!query || !pdf) return;
    const token = ++searchToken.current;
    setPane("search");
    setSearching(true);
    setSearchedOnce(true);
    setHits([]);
    setProgress({ page: 0, total: pdf.numPages });
    setSearchQuery(query);
    try {
      const results = await searchPdfDocument(
        pdf,
        query,
        (next) => {
          if (searchToken.current === token) setProgress(next);
        },
        () => searchToken.current !== token,
      );
      if (searchToken.current === token) setHits(results);
    } catch (error) {
      if (searchToken.current === token) {
        onToast(error instanceof Error ? error.message : "Search failed.", "error");
      }
    } finally {
      if (searchToken.current === token) {
        setSearching(false);
        setProgress(null);
      }
    }
  }, [pdf, searchInput, onToast]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) {
        if (event.key === "Escape") target.blur();
        return;
      }
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setPane("search");
        return;
      }
      if (mod) return;
      switch (event.key) {
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          jumpToPage(pageRef.current - 1);
          break;
        case "ArrowRight":
        case "PageDown":
          event.preventDefault();
          jumpToPage(pageRef.current + 1);
          break;
        case "Home":
          event.preventDefault();
          jumpToPage(1);
          break;
        case "End":
          event.preventDefault();
          jumpToPage(pageCount);
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomBy(1.15);
          break;
        case "-":
          event.preventDefault();
          zoomBy(1 / 1.15);
          break;
        case "0":
          event.preventDefault();
          setZoomMode("fit");
          break;
        case "Escape":
          setPane(null);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [jumpToPage, zoomBy, pageCount]);

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isFinite(parsed)) jumpToPage(parsed);
    else setPageInput(String(currentPage));
    pageInputRef.current?.blur();
  };

  const retry = () => {
    setReloadKey((key) => key + 1);
  };

  if (loading) {
    return (
      <div className="viewer-status">
        <span className="spinner" aria-hidden="true" />
        <p>Opening PDF…</p>
        <span className="viewer-status-detail">{doc.name}</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="viewer-status is-error">
        <span className="status-icon">
          <IconAlert size={24} />
        </span>
        <p>{loadError}</p>
        <div className="status-actions">
          <button className="btn-secondary" onClick={retry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="viewer-toolbar pdf-toolbar">
        <div className="toolbar-group">
          <button
            className={`tool-button ${pane === "outline" ? "is-active" : ""}`}
            onClick={() => setPane((value) => (value === "outline" ? null : "outline"))}
            aria-label="Bookmarks and document info"
            aria-pressed={pane === "outline"}
            title="Bookmarks"
          >
            <IconList size={17} />
          </button>
          <button
            className={`tool-button ${pane === "search" ? "is-active" : ""}`}
            onClick={() => setPane((value) => (value === "search" ? null : "search"))}
            aria-label="Search document"
            aria-pressed={pane === "search"}
            title="Search (Ctrl F)"
          >
            <IconSearch size={17} />
          </button>
        </div>

        <div className="toolbar-group page-nav">
          <button
            className="tool-button"
            onClick={() => jumpToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <IconChevronLeft size={17} />
          </button>
          <input
            ref={pageInputRef}
            className="page-input"
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ""))}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={commitPageInput}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitPageInput();
              if (event.key === "Escape") {
                setPageInput(String(currentPage));
                event.currentTarget.blur();
              }
            }}
            inputMode="numeric"
            aria-label="Page number"
          />
          <span className="page-total">/ {pageCount || "—"}</span>
          <button
            className="tool-button"
            onClick={() => jumpToPage(currentPage + 1)}
            disabled={currentPage >= pageCount}
            aria-label="Next page"
          >
            <IconChevronRight size={17} />
          </button>
        </div>

        <div className="toolbar-spacer" />

        <div className="toolbar-group zoom-group">
          <button className="tool-button" onClick={() => zoomBy(1 / 1.15)} aria-label="Zoom out" title="Zoom out (-)">
            <IconZoomOut size={17} />
          </button>
          <button
            className="zoom-value"
            onClick={() => setZoomMode((mode) => (mode === "fit" ? "custom" : "fit"))}
            title={zoomMode === "fit" ? "Switch to manual zoom" : "Fit to width"}
          >
            {Math.round(scale * 100)}%
          </button>
          <button className="tool-button" onClick={() => zoomBy(1.15)} aria-label="Zoom in" title="Zoom in (+)">
            <IconZoomIn size={17} />
          </button>
          <button
            className={`tool-button ${zoomMode === "fit" ? "is-active" : ""}`}
            onClick={() => setZoomMode("fit")}
            aria-label="Fit to width"
            title="Fit width (0)"
          >
            <IconFitWidth size={17} />
          </button>
        </div>
      </div>

      <div className="pdf-body">
        {pane && (
          <aside className="pdf-side-pane" aria-label={pane === "search" ? "Search" : "Bookmarks"}>
            {pane === "outline" ? (
              <>
                <div className="pane-heading">
                  <h2>Bookmarks</h2>
                  <span>{outline.length ? `${outline.length} top-level` : ""}</span>
                </div>
                <div className="pane-scroll">
                  {outline.length === 0 ? (
                    <p className="pane-empty">This PDF has no bookmarks. Use the page controls to move around.</p>
                  ) : (
                    <OutlineList items={outline} onGo={goToDest} />
                  )}
                  <div className="document-facts">
                    <h3>Document</h3>
                    {metadata.title && (
                      <div>
                        <span>Title</span>
                        <p>{metadata.title}</p>
                      </div>
                    )}
                    {metadata.author && (
                      <div>
                        <span>Author</span>
                        <p>{metadata.author}</p>
                      </div>
                    )}
                    <div>
                      <span>Pages</span>
                      <p>{pageCount}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="pane-heading">
                  <h2>Search</h2>
                  {searchedOnce && !searching && <span>{hits.length} hits</span>}
                </div>
                <form
                  className="search-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runSearch();
                  }}
                >
                  <div className="search-field">
                    <IconSearch size={15} />
                    <input
                      ref={searchInputRef}
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Search this document"
                      aria-label="Search this document"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        className="search-clear"
                        onClick={() => {
                          setSearchInput("");
                          setSearchQuery("");
                          setHits([]);
                          setSearchedOnce(false);
                        }}
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <button className="btn-secondary search-submit" type="submit" disabled={!searchInput.trim() || searching}>
                    {searching ? "Searching…" : "Search"}
                  </button>
                </form>
                <div className="pane-scroll search-results">
                  {searching && (
                    <div className="search-progress">
                      <span className="spinner small" aria-hidden="true" />
                      <p>
                        Searching page {progress?.page ?? 0} of {progress?.total ?? pageCount}…
                      </p>
                    </div>
                  )}
                  {!searching && searchedOnce && hits.length === 0 && (
                    <p className="pane-empty">
                      No matches for “{searchQuery}”. The PDF may contain scanned images without a text layer.
                    </p>
                  )}
                  {!searching &&
                    hits.map((hit, index) => (
                      <button
                        key={`${hit.page}-${hit.offset}-${index}`}
                        className="search-hit"
                        onClick={() => jumpToPage(hit.page)}
                      >
                        <span className="search-hit-page">Page {hit.page}</span>
                        <span className="search-hit-snippet">
                          <Snippet text={hit.snippet} query={searchQuery} />
                        </span>
                      </button>
                    ))}
                  {!searchedOnce && !searching && (
                    <p className="pane-empty">Search across the document's text layer. Results jump to the page.</p>
                  )}
                </div>
              </>
            )}
          </aside>
        )}

        <div className="pdf-scroll" ref={scrollRef}>
          <div className="pdf-pages" ref={pagesRef}>
            {pageCount > 0 ? (
              Array.from({ length: pageCount }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <div
                    key={pageNumber}
                    ref={(node) => {
                      if (node) pageRefs.current.set(pageNumber, node);
                      else pageRefs.current.delete(pageNumber);
                    }}
                  >
                    <PdfPage
                      pdf={pdf as PDFDocumentProxy}
                      pageNumber={pageNumber}
                      scale={scale}
                      estimatedHeight={pageSize.height * scale}
                      scrollRef={scrollRef}
                      searchQuery={searchQuery}
                      onDest={goToDest}
                      onError={handlePageError}
                      onToast={onToast}
                    />
                  </div>
                );
              })
            ) : (
              <div className="viewer-status">
                <span className="spinner" aria-hidden="true" />
                <p>Preparing pages…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

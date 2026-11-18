import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { OpenDocument } from "../types";
import { extensionOf } from "../lib/filetype";
import { formatBytes } from "../lib/format";
import { isZipContainer, parsePresentation } from "../lib/presentation";
import type { ParsedPresentation } from "../lib/presentation";
import type { Presentation as VisualPresentation } from "../lib/slides/parse";
import {
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
  IconFitWidth,
  IconInfo,
  IconPresentation,
  IconRefresh,
  IconSearch,
  IconZoomIn,
  IconZoomOut,
} from "./Icons";
import { SlideCanvas } from "./slides/SlideCanvas";
import { SlideShow } from "./slides/SlideShow";
import "./slides/slideStyles.css";
import { IconList } from "./Icons";

interface PresentationViewerProps {
  doc: OpenDocument;
}

type ViewMode = "visual" | "text";

function highlight(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;
  const haystack = text.toLowerCase();
  const target = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let position = haystack.indexOf(target);
  let key = 0;
  while (position !== -1) {
    if (position > cursor) parts.push(text.slice(cursor, position));
    parts.push(<mark key={key++}>{text.slice(position, position + target.length)}</mark>);
    cursor = position + target.length;
    position = haystack.indexOf(target, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "This presentation could not be read.";
}

export default function PresentationViewer({ doc }: PresentationViewerProps) {
  const [parsed, setParsed] = useState<ParsedPresentation | null>(null);
  const [deck, setDeck] = useState<VisualPresentation | null>(null);
  const [richError, setRichError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [query, setQuery] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [view, setView] = useState<ViewMode>("visual");
  const [presenting, setPresenting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const stage = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let activeDeck: VisualPresentation | null = null;
    setParsed(null);
    setDeck(null);
    setRichError(null);
    setError(null);
    setCurrent(0);
    setQuery("");
    setShowNotes(false);
    setView("visual");
    setPresenting(false);

    parsePresentation(doc.bytes, extensionOf(doc.name))
      .then((result) => {
        if (!cancelled) setParsed(result);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(errorMessage(loadError));
      });

    if (isZipContainer(doc.bytes)) {
      import("../lib/slides/parse")
        .then(({ parseVisualPptxAsync }) =>
          parseVisualPptxAsync(doc.bytes, controller.signal),
        )
        .then((result) => {
          if (cancelled || controller.signal.aborted) {
            result.dispose();
            return;
          }
          activeDeck = result;
          setDeck(result);
        })
        .catch((loadError: unknown) => {
          if (cancelled || controller.signal.aborted) return;
          if (loadError instanceof DOMException && loadError.name === "AbortError") return;
          setRichError(errorMessage(loadError));
        });
    }

    return () => {
      cancelled = true;
      controller.abort();
      activeDeck?.dispose();
    };
  }, [doc.id, doc.bytes, reloadKey]);

  const slides = useMemo(() => parsed?.slides ?? [], [parsed]);
  const slide = slides[Math.min(current, Math.max(slides.length - 1, 0))];
  const visualSlide = deck
    ? deck.slides[Math.min(current, Math.max(deck.slides.length - 1, 0))]
    : undefined;

  useEffect(() => {
    if (!fit || view !== "visual" || !deck || !stage.current) return;
    const element = stage.current;
    const update = () => {
      const availableWidth = element.clientWidth - 48;
      const availableHeight = Math.max(240, element.clientHeight - 48);
      const next = Math.min(
        availableWidth / deck.width,
        availableHeight / deck.height,
        1.5,
      );
      if (Number.isFinite(next) && next > 0) setZoom(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [deck, fit, view]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return slides
      .filter((item) =>
        [item.title, ...item.paragraphs.map((paragraph) => paragraph.text), item.notes].some(
          (text) => text.toLowerCase().includes(needle),
        ),
      )
      .map((item) => item.number - 1);
  }, [slides, query]);

  const goTo = useCallback(
    (index: number) => {
      setCurrent(Math.min(Math.max(index, 0), Math.max(slides.length - 1, 0)));
    },
    [slides.length],
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const previous = useCallback(() => goTo(current - 1), [current, goTo]);
  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    const upcoming = matches.find((index) => index > current);
    goTo(upcoming === undefined ? matches[0] : upcoming);
  }, [matches, current, goTo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (presenting) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      } else if (event.key === "F5") {
        event.preventDefault();
        if (deck || parsed?.format === "pptx") setPresenting(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, presenting, deck, parsed]);

  if (error) {
    return (
      <div className="viewer-status is-error">
        <span className="status-icon">
          <IconAlert size={24} />
        </span>
        <p>{error}</p>
        <div className="status-actions">
          <button className="btn-secondary" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (slides.length === 0 && parsed) {
    return (
      <div className="viewer-status">
        <span className="status-icon">
          <IconPresentation size={24} />
        </span>
        <p>This presentation has no readable slides.</p>
        <span className="viewer-status-detail">{doc.name}</span>
      </div>
    );
  }

  if (!parsed || !slide) {
    return (
      <div className="viewer-status">
        <span className="spinner" aria-hidden="true" />
        <p>Reading presentation…</p>
        <span className="viewer-status-detail">{doc.name}</span>
      </div>
    );
  }

  return (
    <div className="presentation-viewer">
      <div className="viewer-toolbar presentation-toolbar">
        <span className="file-kind-chip">
          <IconPresentation size={14} />
          PowerPoint
        </span>
        <span className="toolbar-meta">
          {slides.length} {slides.length === 1 ? "slide" : "slides"} ·{" "}
          {parsed.format === "pptx" ? "PPTX" : "legacy text"} · {formatBytes(doc.size)}
        </span>
        <div className="toolbar-group presentation-nav">
          <button
            className="tool-button"
            onClick={previous}
            disabled={current === 0}
            title="Previous slide (←)"
            aria-label="Previous slide"
          >
            <IconChevronLeft size={16} />
          </button>
          <span className="slide-counter">
            {current + 1} / {slides.length}
          </span>
          <button
            className="tool-button"
            onClick={next}
            disabled={current === slides.length - 1}
            title="Next slide (→)"
            aria-label="Next slide"
          >
            <IconChevronRight size={16} />
          </button>
        </div>
        <button
          className={`toggle-chip ${showNotes ? "is-active" : ""}`}
          onClick={() => setShowNotes((value) => !value)}
          aria-pressed={showNotes}
          title="Show speaker notes"
        >
          Notes
        </button>
        {parsed.format === "pptx" && (
          <>
            <button
              className="tool-button"
              onClick={() => {
                if (deck || parsed.format === "pptx") setPresenting(true);
              }}
              title="Slide show (F5)"
              aria-label="Start slide show"
            >
              <IconPresentation size={15} />
            </button>
            <button
              className={`toggle-chip ${view === "visual" ? "is-active" : ""}`}
              onClick={() => setView((value) => (value === "visual" ? "text" : "visual"))}
              title="Switch between drawn slides and extracted text"
              aria-label="Switch slide view"
            >
              <IconList size={14} />
              {view === "visual" ? "Drawn" : "Text"}
            </button>
          </>
        )}
        {view === "visual" && deck && (
          <div className="toolbar-group slide-zoom">
            <button
              className="tool-button"
              onClick={() => {
                setFit(false);
                setZoom((value) => Math.max(0.25, value - 0.15));
              }}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <IconZoomOut size={15} />
            </button>
            <button
              className={`tool-button ${fit ? "is-active" : ""}`}
              onClick={() => setFit(true)}
              title="Fit slide"
              aria-label="Fit slide"
            >
              <IconFitWidth size={15} />
            </button>
            <button
              className="tool-button"
              onClick={() => {
                setFit(false);
                setZoom((value) => Math.min(2.5, value + 0.15));
              }}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <IconZoomIn size={15} />
            </button>
          </div>
        )}
        <div className="search-field presentation-filter">
          <IconSearch size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                nextMatch();
              }
            }}
            placeholder="Find in slides"
            aria-label="Find in slides"
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        {query && (
          <span className="toolbar-meta presentation-match-count">
            {matches.length} {matches.length === 1 ? "slide" : "slides"}
          </span>
        )}
      </div>

      {parsed.notice && (
        <div className="presentation-notice" role="status">
          <IconInfo size={15} />
          <span>{parsed.notice}</span>
          <button
            className="icon-button"
            onClick={() => setReloadKey((key) => key + 1)}
            title="Re-open presentation"
            aria-label="Re-open presentation"
          >
            <IconRefresh size={15} />
          </button>
        </div>
      )}

      {richError && (
        <div className="presentation-notice" role="status">
          <IconInfo size={15} />
          <span>Drawn slides are unavailable: {richError} Showing extracted text instead.</span>
        </div>
      )}

      <div className="presentation-body">
        <aside className="slide-rail" aria-label="Slides">
          {slides.map((item, index) => (
            <button
              key={item.number}
              className={`slide-rail-item ${index === current ? "is-active" : ""} ${
                matches.includes(index) ? "has-match" : ""
              } ${item.hidden ? "is-hidden" : ""}`}
              onClick={() => goTo(index)}
              aria-current={index === current ? "true" : undefined}
              title={item.hidden ? "Hidden slide" : undefined}
            >
              <span className="slide-rail-number">{item.number}</span>
              <span className="slide-rail-title">{highlight(item.title, query)}</span>
            </button>
          ))}
        </aside>

        <div className="presentation-scroll" ref={stage}>
          {view === "visual" && visualSlide && deck ? (
            <div className="slide-visual-stage">
              <div
                className="slide-visual-shell"
                style={{ width: deck.width * zoom, height: deck.height * zoom }}
              >
                <div
                  style={{
                    width: deck.width,
                    height: deck.height,
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                  }}
                >
                  <SlideCanvas
                    slide={visualSlide}
                    width={deck.width}
                    height={deck.height}
                    query={query}
                  />
                </div>
              </div>
            </div>
          ) : view === "visual" ? (
            <div className="slide-visual-fallback">
              <IconPresentation size={28} />
              <p>Drawing this deck on this device is not available. extracted text is shown below.</p>
            </div>
          ) : null}

          <article className="slide-card" hidden={view === "visual"}>
            <div className="slide-card-label">
              Slide {slide.number}
              {slide.hidden && <span className="slide-hidden-badge">Hidden</span>}
            </div>
            <h2 className="slide-title">{highlight(slide.title, query)}</h2>
            {slide.paragraphs.length > 0 ? (
              <div className="slide-paragraphs">
                {slide.paragraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className="slide-paragraph"
                    style={{ marginLeft: paragraph.level * 22 }}
                  >
                    {paragraph.bullet && (
                      <span className="slide-bullet" aria-hidden="true">
                        {paragraph.bullet}
                      </span>
                    )}
                    {highlight(paragraph.text, query)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="slide-empty">No text on this slide.</p>
            )}
            {showNotes && (
              <section className="slide-notes">
                <h3>Speaker notes</h3>
                {slide.notes ? (
                  <p>{highlight(slide.notes, query)}</p>
                ) : (
                  <p className="slide-empty">No speaker notes on this slide.</p>
                )}
              </section>
            )}
          </article>
        </div>
      </div>

      {presenting && deck && (
        <SlideShow
          deck={deck}
          start={current}
          onClose={(index) => {
            setCurrent(Math.min(index, slides.length - 1));
            setPresenting(false);
          }}
        />
      )}
    </div>
  );
}

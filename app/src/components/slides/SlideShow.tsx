// Compact full-screen slide show adapted from Paperwren's Present.tsx
// (MIT License, Copyright (c) 2026 Paperwren contributors). All interaction is
// local: keyboard, pointer, touch and the browser Fullscreen API.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Presentation } from "../../lib/slides/parse";
import { SlideCanvas } from "./SlideCanvas";
import "./slideStyles.css";

interface SlideShowProps {
  deck: Presentation;
  start: number;
  onClose: (index: number) => void;
}

function visibleIndices(deck: Presentation): number[] {
  const indices = deck.slides.map((_, index) => index).filter((index) => !deck.slides[index].hidden);
  return indices.length ? indices : deck.slides.map((_, index) => index);
}

export function SlideShow({ deck, start, onClose }: SlideShowProps) {
  const indices = useMemo(() => visibleIndices(deck), [deck]);
  const initial = indices.includes(start)
    ? start
    : indices[Math.min(indices.length - 1, Math.max(0, indices.findIndex((i) => i >= start)))] ?? start;
  const [index, setIndex] = useState(initial);
  const [notes, setNotes] = useState(false);
  const [presenter, setPresenter] = useState(false);
  const [laser, setLaser] = useState(false);
  const [laserAt, setLaserAt] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [clock, setClock] = useState(() => new Date());
  const started = useRef(Date.now());
  const overlay = useRef<HTMLDivElement | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const laserTimer = useRef<number | null>(null);

  const position = Math.max(0, indices.indexOf(index));
  const slide = deck.slides[index];
  const nextIndex = indices[(position + 1) % indices.length];

  const go = useCallback(
    (delta: number) => {
      const nextPosition = Math.min(
        indices.length - 1,
        Math.max(0, position + delta),
      );
      setIndex(indices[nextPosition]);
    },
    [indices, position],
  );

  const close = useCallback(() => onClose(index), [index, onClose]);

  useEffect(() => {
    overlay.current?.focus();
    const element = overlay.current;
    if (element?.requestFullscreen) {
      void element.requestFullscreen().catch(() => undefined);
    }
    return () => {
      if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!presenter) return;
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [presenter]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp" || event.key === "Backspace") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        setIndex(indices[0]);
      } else if (event.key === "End") {
        event.preventDefault();
        setIndex(indices[indices.length - 1]);
      } else if (event.key.toLowerCase() === "n") {
        setNotes((value) => !value);
      } else if (event.key.toLowerCase() === "p") {
        setPresenter((value) => !value);
      } else if (event.key.toLowerCase() === "l") {
        setLaser((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, go, indices]);

  useLayoutEffect(() => {
    if (!laser) return;
    const onMove = (event: PointerEvent) => setLaserAt({ x: event.clientX, y: event.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [laser]);

  const showLaser = (x: number, y: number) => {
    if (!laser) return;
    setLaserAt({ x, y });
    if (laserTimer.current) window.clearTimeout(laserTimer.current);
    laserTimer.current = window.setTimeout(() => setLaserAt(null), 1200);
  };

  const scale = Math.min(
    (size.width - (presenter ? 80 : 48)) / deck.width,
    (size.height - (presenter ? 200 : 110)) / deck.height,
    2,
  );
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 0.5;

  const elapsed = Math.floor((clock.getTime() - started.current) / 1000);
  const stopwatch = `${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`;

  if (!slide) return null;

  return createPortal(
    <div
      ref={overlay}
      className="sl-present"
      tabIndex={-1}
      role="dialog"
      aria-label="Slide show"
      onPointerMove={(event) => showLaser(event.clientX, event.clientY)}
      onTouchStart={(event) => {
        const point = event.touches[0];
        touch.current = { x: point.clientX, y: point.clientY };
      }}
      onTouchEnd={(event) => {
        const startPoint = touch.current;
        const point = event.changedTouches[0];
        touch.current = null;
        if (!startPoint || !point) return;
        const dx = point.clientX - startPoint.x;
        const dy = point.clientY - startPoint.y;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        else if (Math.abs(dy) > 50) go(dy < 0 ? 1 : -1);
      }}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button") || target.closest("a")) return;
        const edge = size.width * 0.22;
        if (event.clientX < edge) go(-1);
        else if (event.clientX > size.width - edge) go(1);
      }}
    >
      {presenter ? (
        <div className="sl-presenter">
          <div className="sl-presenter-main">
            <div className="sl-present-stage">
              <div
                style={{
                  width: deck.width * safeScale,
                  height: deck.height * safeScale,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: deck.width,
                    height: deck.height,
                    transform: `scale(${safeScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <SlideCanvas slide={slide} width={deck.width} height={deck.height} />
                </div>
              </div>
            </div>
          </div>
          <div className="sl-presenter-side">
            <div>
              <h3>Next</h3>
              <div className="sl-presenter-next">
                <SlideCanvas
                  slide={deck.slides[nextIndex]}
                  width={deck.width}
                  height={deck.height}
                  compact
                />
              </div>
            </div>
            <div>
              <h3>Elapsed</h3>
              <div className="sl-presenter-clock">{stopwatch}</div>
            </div>
            <div>
              <h3>Time</h3>
              <div className="sl-presenter-clock">
                {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div>
              <h3>Notes</h3>
              <div className="sl-presenter-notes">{slide.notes || "No speaker notes."}</div>
            </div>
            <button type="button" onClick={() => setPresenter(false)}>
              Leave presenter view
            </button>
          </div>
        </div>
      ) : (
        <div className="sl-present-stage">
          <div
            style={{
              width: deck.width * safeScale,
              height: deck.height * safeScale,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: deck.width,
                height: deck.height,
                transform: `scale(${safeScale})`,
                transformOrigin: "top left",
              }}
            >
              <SlideCanvas slide={slide} width={deck.width} height={deck.height} />
            </div>
          </div>
        </div>
      )}

      {!presenter && notes && slide.notes && (
        <div className="sl-present-notes">{slide.notes}</div>
      )}

      <div className="sl-present-controls">
        <span>
          {position + 1} / {indices.length}
          {slide.hidden && <span className="sl-present-tag">Hidden</span>}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => go(-1)}>Previous</button>
          <button type="button" onClick={() => go(1)}>Next</button>
          <button type="button" onClick={() => setNotes((value) => !value)}>Notes</button>
          <button type="button" onClick={() => setPresenter((value) => !value)}>Presenter</button>
          <button type="button" onClick={() => setLaser((value) => !value)}>Laser</button>
          <button type="button" onClick={close}>Close</button>
        </span>
      </div>

      {laser && laserAt && (
        <div className="sl-laser" style={{ left: laserAt.x, top: laserAt.y }} />
      )}
    </div>,
    document.body,
  );
}

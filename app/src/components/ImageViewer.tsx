import { useEffect, useMemo, useRef, useState } from "react";
import type { OpenDocument } from "../types";
import { extensionOf } from "../lib/filetype";
import { clamp, formatBytes } from "../lib/format";
import { IconAlert, IconFitWidth, IconImage, IconZoomIn, IconZoomOut } from "./Icons";

interface ImageViewerProps {
  doc: OpenDocument;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

export default function ImageViewer({ doc }: ImageViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<"fit" | "custom">("fit");
  const [customScale, setCustomScale] = useState(1);
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mime = MIME_BY_EXTENSION[extensionOf(doc.name)] ?? "application/octet-stream";
    const blob = new Blob([doc.bytes.slice().buffer as ArrayBuffer], { type: mime });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    setNatural(null);
    setError(false);
    setMode("fit");
    return () => URL.revokeObjectURL(objectUrl);
  }, [doc.bytes, doc.name]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setContainer({ width: node.clientWidth, height: node.clientHeight });
    });
    observer.observe(node);
    setContainer({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (!natural || container.width === 0 || container.height === 0) return 1;
    return Math.min(
      Math.max(40, container.width - 96) / natural.width,
      Math.max(40, container.height - 96) / natural.height,
      1,
    );
  }, [natural, container]);

  const scale = mode === "fit" ? fitScale : customScale;

  const zoomBy = (factor: number) => {
    setMode("custom");
    setCustomScale(clamp(scale * factor, 0.05, 12));
  };

  return (
    <div className="image-viewer">
      <div className="viewer-toolbar">
        <span className="file-kind-chip">
          <IconImage size={14} />
          {extensionOf(doc.name).toUpperCase() || "Image"}
        </span>
        <span className="toolbar-meta">
          {natural ? `${natural.width} × ${natural.height} px · ` : ""}
          {formatBytes(doc.size)}
        </span>
        <div className="toolbar-spacer" />
        <div className="toolbar-group zoom-group">
          <button className="tool-button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" title="Zoom out">
            <IconZoomOut size={17} />
          </button>
          <button
            className="zoom-value"
            onClick={() => setMode((value) => (value === "fit" ? "custom" : "fit"))}
            title={mode === "fit" ? "Switch to manual zoom" : "Fit to window"}
          >
            {Math.round(scale * 100)}%
          </button>
          <button className="tool-button" onClick={() => zoomBy(1.2)} aria-label="Zoom in" title="Zoom in">
            <IconZoomIn size={17} />
          </button>
          <button
            className={`tool-button ${mode === "fit" ? "is-active" : ""}`}
            onClick={() => setMode("fit")}
            aria-label="Fit to window"
            title="Fit to window"
          >
            <IconFitWidth size={17} />
          </button>
          <button
            className="tool-text-button"
            onClick={() => {
              setMode("custom");
              setCustomScale(1);
            }}
            title="Actual size"
          >
            1:1
          </button>
        </div>
      </div>

      <div className="image-stage" ref={stageRef}>
        {error ? (
          <div className="viewer-status is-error">
            <span className="status-icon">
              <IconAlert size={24} />
            </span>
            <p>This image could not be displayed.</p>
            <span className="viewer-status-detail">The file may be corrupted or use an unsupported codec.</span>
          </div>
        ) : (
          <div className="image-stage-inner">
            {url && natural && (
              <img
                src={url}
                alt={doc.name}
                draggable={false}
                onError={() => setError(true)}
                style={{ width: `${natural.width * scale}px`, height: `${natural.height * scale}px` }}
              />
            )}
            {url && !natural && !error && (
              <img
                src={url}
                alt=""
                className="image-measure"
                onLoad={(event) => {
                  const image = event.currentTarget;
                  setNatural({
                    width: image.naturalWidth || 1,
                    height: image.naturalHeight || 1,
                  });
                }}
                onError={() => setError(true)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

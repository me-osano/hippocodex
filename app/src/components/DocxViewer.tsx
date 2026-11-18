import { useEffect, useState } from "react";
import mammoth from "mammoth";
import DOMPurify from "dompurify";
import type { OpenDocument } from "../types";
import { countWords } from "../lib/text";
import { formatBytes } from "../lib/format";
import { IconAlert, IconDoc } from "./Icons";

interface DocxViewerProps {
  doc: OpenDocument;
}

export default function DocxViewer({ doc }: DocxViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [words, setWords] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    setWarnings(0);

    const buffer = doc.bytes.slice().buffer as ArrayBuffer;
    mammoth
      .convertToHtml({ arrayBuffer: buffer })
      .then((result) => {
        if (cancelled) return;
        const clean = DOMPurify.sanitize(result.value, {
          USE_PROFILES: { html: true },
          FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
        });
        setHtml(clean);
        const plain = new DOMParser().parseFromString(clean, "text/html").body.textContent ?? "";
        setWords(countWords(plain));
        setWarnings(result.messages.filter((message) => message.type === "warning").length);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? `This Word document could not be read. ${loadError.message}`
            : "This Word document could not be read.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [doc.bytes, reloadKey]);

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

  if (html === null) {
    return (
      <div className="viewer-status">
        <span className="spinner" aria-hidden="true" />
        <p>Converting Word document…</p>
        <span className="viewer-status-detail">{doc.name}</span>
      </div>
    );
  }

  if (words === 0 && !/<img\b/i.test(html)) {
    return (
      <div className="viewer-status">
        <span className="status-icon">
          <IconDoc size={24} />
        </span>
        <p>No readable text in this Word document.</p>
        <span className="viewer-status-detail">
          It may be empty, or the file may not be a real .docx document.
        </span>
      </div>
    );
  }

  return (
    <div className="docx-viewer">
      <div className="viewer-toolbar">
        <span className="file-kind-chip">
          <IconDoc size={14} />
          Word
        </span>
        <span className="toolbar-meta">
          {words.toLocaleString()} words · {formatBytes(doc.size)}
          {warnings > 0 ? ` · ${warnings} formatting ${warnings === 1 ? "warning" : "warnings"}` : ""}
        </span>
        <div className="toolbar-spacer" />
        <span className="toolbar-note">Converted locally with Mammoth</span>
      </div>
      <div className="docx-scroll">
        <article className="markdown-content docx-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

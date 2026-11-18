import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import hljs from "highlight.js/lib/common";
import type { OpenDocument } from "../types";
import { countLines, decodeUtf8 } from "../lib/text";
import { useNoteEditor } from "../hooks/useNoteEditor";
import { IconCode, IconHash, IconPencil, IconSave, IconWrap } from "./Icons";

interface TextViewerProps {
  doc: OpenDocument;
  onSave?: (text: string) => Promise<boolean>;
}

const MAX_HIGHLIGHT_SIZE = 400_000;

export default function TextViewer({ doc, onSave }: TextViewerProps) {
  const source = useMemo(() => decodeUtf8(doc.bytes), [doc.bytes]);
  const [wrap, setWrap] = useState(doc.kind !== "code");
  const [lineNumbers, setLineNumbers] = useState(doc.kind === "code");
  const [fontSize, setFontSize] = useState(14);
  const [editing, setEditing] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const editor = useNoteEditor(doc, onSave, editing);

  useEffect(() => {
    if (editing) editorRef.current?.focus();
  }, [editing]);

  const language = doc.language;
  const highlighted = useMemo(() => {
    if (!language || source.length > MAX_HIGHLIGHT_SIZE) return null;
    try {
      if (!hljs.getLanguage(language)) return null;
      return hljs.highlight(source, { language, ignoreIllegals: true }).value;
    } catch {
      return null;
    }
  }, [language, source]);

  const lines = useMemo(() => countLines(source), [source]);
  const showGutter = lineNumbers && !wrap;

  const leaveEditor = () => {
    editor.revert();
    setEditing(false);
  };

  return (
    <div className="text-viewer">
      <div className="viewer-toolbar">
        <span className="file-kind-chip">
          <IconCode size={14} />
          {language ?? "plain text"}
        </span>
        <span className={`toolbar-meta ${editor.dirty ? "is-dirty" : ""}`}>
          {editor.dirty
            ? "Unsaved changes"
            : `${lines.toLocaleString()} lines · ${source.length.toLocaleString()} characters`}
        </span>
        <div className="toolbar-spacer" />
        {editing ? (
          <div className="toolbar-group">
            <button className="tool-button" onClick={leaveEditor} disabled={editor.saving}>
              Cancel
            </button>
            <button
              className="tool-button is-active"
              onClick={() => void editor.save()}
              disabled={editor.saving || !editor.dirty}
              title="Save note (Ctrl/⌘ + S)"
            >
              <IconSave size={15} />
              {editor.saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <div className="toolbar-group">
            <button
              className="tool-button"
              onClick={() => setFontSize((size) => Math.max(10, size - 1))}
              aria-label="Decrease font size"
              title="Decrease font size"
            >
              A−
            </button>
            <span className="font-size-label">{fontSize}px</span>
            <button
              className="tool-button"
              onClick={() => setFontSize((size) => Math.min(28, size + 1))}
              aria-label="Increase font size"
              title="Increase font size"
            >
              A+
            </button>
            <button
              className={`tool-button ${lineNumbers ? "is-active" : ""}`}
              onClick={() => {
                if (!lineNumbers) {
                  setLineNumbers(true);
                  setWrap(false);
                } else {
                  setLineNumbers(false);
                }
              }}
              aria-label="Toggle line numbers"
              aria-pressed={lineNumbers}
              title="Line numbers (turns off wrapping)"
            >
              <IconHash size={16} />
            </button>
            <button
              className={`tool-button ${wrap ? "is-active" : ""}`}
              onClick={() => setWrap((value) => !value)}
              aria-label="Toggle line wrapping"
              aria-pressed={wrap}
              title="Wrap lines"
            >
              <IconWrap size={17} />
            </button>
            {onSave && (
              <button
                className="tool-button"
                onClick={() => setEditing(true)}
                aria-label="Edit note"
                title="Edit note"
              >
                <IconPencil size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <textarea
          ref={editorRef}
          className={`note-editor text-editor ${wrap ? "is-wrapped" : "is-nowrap"}`}
          style={{ "--code-size": `${fontSize}px` } as CSSProperties}
          value={editor.draft}
          onChange={(event) => editor.update(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              leaveEditor();
            }
          }}
          spellCheck
          aria-label="Edit text note"
          placeholder="Write your note…"
        />
      ) : (
        <div
          className="text-scroll"
          style={{ "--code-size": `${fontSize}px` } as CSSProperties}
        >
          <div className={`code-block ${wrap ? "is-wrapped" : ""} ${showGutter ? "has-gutter" : ""}`}>
            {showGutter && (
              <div className="code-gutter" aria-hidden="true">
                {Array.from({ length: lines }, (_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
            )}
            <pre className="code-pre">
              {highlighted ? (
                <code
                  className={`hljs language-${language}`}
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              ) : (
                <code className="hljs">{source}</code>
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

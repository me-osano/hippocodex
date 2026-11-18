import { isValidElement, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkFrontmatter from "remark-frontmatter";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import type { OpenDocument } from "../types";
import { extractHeadings, slugifyHeading, stripFrontmatter } from "../lib/markdown";
import { countWords, decodeUtf8 } from "../lib/text";
import { useNoteEditor } from "../hooks/useNoteEditor";
import { IconBook, IconCode, IconHash, IconList, IconPencil, IconSave } from "./Icons";

interface MarkdownViewerProps {
  doc: OpenDocument;
  onSave?: (text: string) => Promise<boolean>;
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) {
    return nodeText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function buildComponents(): Components {
  const seen = new Map<string, number>();
  const heading =
    (depth: 1 | 2 | 3 | 4 | 5 | 6) =>
    ({ children }: { children?: ReactNode }) => {
      const text = nodeText(children).trim();
      const base = slugifyHeading(text) || "section";
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      const Tag = `h${depth}` as const;
      return (
        <Tag id={id} className="md-heading">
          {children}
          <a className="md-heading-anchor" href={`#${id}`} aria-label="Link to this section">
            #
          </a>
        </Tag>
      );
    };

  return {
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    h5: heading(5),
    h6: heading(6),
    a: ({ href, children, title }) => {
      const external = Boolean(href && /^https?:\/\//i.test(href));
      return (
        <a
          href={href}
          title={title}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer noopener" : undefined}
        >
          {children}
        </a>
      );
    },
    table: ({ children }) => (
      <div className="md-table-wrap">
        <table>{children}</table>
      </div>
    ),
  };
}

export default function MarkdownViewer({ doc, onSave }: MarkdownViewerProps) {
  const source = useMemo(() => decodeUtf8(doc.bytes), [doc.bytes]);
  const body = useMemo(() => stripFrontmatter(source), [source]);
  const headings = useMemo(() => extractHeadings(body), [body]);
  const components = buildComponents();
  const [mode, setMode] = useState<"rendered" | "source" | "edit">("rendered");
  const [tocOpen, setTocOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const editor = useNoteEditor(doc, onSave, mode === "edit");

  useEffect(() => {
    if (mode === "edit") editorRef.current?.focus();
  }, [mode]);

  const goToHeading = (index: number) => {
    const container = scrollRef.current;
    const element = contentRef.current?.querySelectorAll<HTMLElement>(".md-heading")[index];
    if (!container || !element) return;
    const top =
      element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 24;
    container.scrollTo({ top, behavior: "smooth" });
  };

  const leaveEditor = () => {
    editor.revert();
    setMode("rendered");
  };

  return (
    <div className="markdown-viewer">
      <div className="viewer-toolbar">
        <div className="segmented" role="group" aria-label="Markdown view">
          <button
            className={mode === "rendered" ? "is-active" : ""}
            onClick={() => setMode("rendered")}
            aria-pressed={mode === "rendered"}
          >
            <IconBook size={15} />
            Reading
          </button>
          <button
            className={mode === "source" ? "is-active" : ""}
            onClick={() => setMode("source")}
            aria-pressed={mode === "source"}
          >
            <IconCode size={15} />
            Source
          </button>
          {onSave && (
            <button
              className={mode === "edit" ? "is-active" : ""}
              onClick={() => setMode("edit")}
              aria-pressed={mode === "edit"}
            >
              <IconPencil size={15} />
              Edit
            </button>
          )}
        </div>
        <span className={`toolbar-meta ${editor.dirty ? "is-dirty" : ""}`}>
          {editor.dirty
            ? "Unsaved changes"
            : `${countWords(body).toLocaleString()} words · ${headings.length} headings`}
        </span>
        <div className="toolbar-spacer" />
        {mode === "edit" ? (
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
          mode === "rendered" &&
          headings.length > 0 && (
            <button
              className={`tool-button ${tocOpen ? "is-active" : ""}`}
              onClick={() => setTocOpen((open) => !open)}
              title="Table of contents"
              aria-label="Toggle table of contents"
              aria-pressed={tocOpen}
            >
              <IconList size={17} />
            </button>
          )
        )}
      </div>

      <div className="markdown-body-layout">
        {mode === "rendered" && tocOpen && headings.length > 0 && (
          <aside className="markdown-toc" aria-label="Table of contents">
            <div className="pane-heading">
              <h2>
                <IconHash size={14} /> On this page
              </h2>
            </div>
            <nav className="toc-list">
              {headings.map((heading, index) => (
                <button
                  key={`${heading.id}-${index}`}
                  className={`toc-item depth-${heading.depth}`}
                  onClick={() => goToHeading(index)}
                >
                  {heading.text}
                </button>
              ))}
            </nav>
          </aside>
        )}

        <div className="markdown-scroll" ref={scrollRef}>
          {mode === "edit" ? (
            <textarea
              ref={editorRef}
              className="note-editor markdown-editor"
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
              aria-label="Edit Markdown note"
              placeholder="Write your note…"
            />
          ) : mode === "rendered" ? (
            <article className="markdown-content" ref={contentRef}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath, remarkFrontmatter]}
                rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
                components={components}
              >
                {body}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="markdown-source">
              <pre>{source}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { Suspense, lazy } from "react";
import type { OpenDocument } from "../types";
import { KIND_LABELS } from "../types";
import { ViewerErrorBoundary } from "./ViewerErrorBoundary";
import TextViewer from "./TextViewer";
import ImageViewer from "./ImageViewer";
import CsvViewer from "./CsvViewer";

const PdfViewer = lazy(() => import("./PdfViewer"));
const MarkdownViewer = lazy(() => import("./MarkdownViewer"));
const DocxViewer = lazy(() => import("./DocxViewer"));
const ExcelViewer = lazy(() => import("./ExcelViewer"));
const PresentationViewer = lazy(() => import("./PresentationViewer"));

interface ViewerProps {
  doc: OpenDocument;
  onClose: () => void;
  onToast: (message: string, tone?: "info" | "error") => void;
  canEdit: boolean;
  onSaveNote: (doc: OpenDocument, text: string) => Promise<boolean>;
}

export function Viewer({ doc, onClose, onToast, canEdit, onSaveNote }: ViewerProps) {
  let content;
  const onSave = canEdit ? (text: string) => onSaveNote(doc, text) : undefined;

  switch (doc.kind) {
    case "pdf":
      content = <PdfViewer doc={doc} onToast={onToast} />;
      break;
    case "markdown":
      content = <MarkdownViewer doc={doc} onSave={onSave} />;
      break;
    case "docx":
      content = <DocxViewer doc={doc} />;
      break;
    case "image":
      content = <ImageViewer doc={doc} />;
      break;
    case "csv":
      content = <CsvViewer doc={doc} />;
      break;
    case "spreadsheet":
      content = <ExcelViewer doc={doc} />;
      break;
    case "presentation":
      content = <PresentationViewer doc={doc} />;
      break;
    case "text":
    case "code":
    default:
      content = <TextViewer doc={doc} onSave={onSave} />;
      break;
  }

  return (
    <ViewerErrorBoundary resetKey={doc.id} onClose={onClose}>
      <Suspense
        fallback={
          <div className="viewer-status">
            <span className="spinner" aria-hidden="true" />
            <p>Opening {KIND_LABELS[doc.kind].toLowerCase()}…</p>
            <span className="viewer-status-detail">{doc.name}</span>
          </div>
        }
      >
        {content}
      </Suspense>
    </ViewerErrorBoundary>
  );
}

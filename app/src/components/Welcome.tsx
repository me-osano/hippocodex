import type { RecentDocument } from "../types";
import { IconBook, IconCode, IconDoc, IconFilePdf, IconImage, IconOpen, IconTable } from "./Icons";
import { RecentCard } from "./Sidebar";

interface WelcomeProps {
  recents: RecentDocument[];
  onOpen: () => void;
  onOpenRecent: (recent: RecentDocument) => void;
}

const FORMATS = [
  { icon: <IconFilePdf size={18} />, label: "PDF" },
  { icon: <IconBook size={18} />, label: "Markdown" },
  { icon: <IconCode size={18} />, label: "Text & code" },
  { icon: <IconImage size={18} />, label: "Images" },
  { icon: <IconTable size={18} />, label: "CSV / TSV / Excel" },
  { icon: <IconDoc size={18} />, label: "DOCX" },
];

export function Welcome({ recents, onOpen, onOpenRecent }: WelcomeProps) {
  return (
    <div className="welcome-scroll">
      <div className="welcome">
        <div className="welcome-hero">
          <span className="eyebrow">Local-first · built for deep reading</span>
          <h1>
            A quieter place
            <br />
            to study.
          </h1>
          <p className="welcome-lede">
            Open a paper, a chapter, or a page of notes. Hippocodex renders it here, on your machine,
            without uploading a word.
          </p>
        </div>

        <button className="dropzone" onClick={onOpen}>
          <span className="dropzone-icon">
            <IconOpen size={26} />
          </span>
          <span className="dropzone-title">Open a document</span>
          <span className="dropzone-hint">Choose a file, or drop one anywhere in this window</span>
          <span className="dropzone-formats">
            {FORMATS.map((format) => (
              <span className="format-chip" key={format.label}>
                {format.icon}
                {format.label}
              </span>
            ))}
          </span>
        </button>

        {recents.length > 0 && (
          <section className="welcome-recents" aria-labelledby="recent-heading">
            <div className="welcome-section-heading">
              <h2 id="recent-heading">Recently opened</h2>
              <span>{recents.length > 4 ? "Pick up where you left off" : ""}</span>
            </div>
            <div className="recent-card-grid">
              {recents.slice(0, 6).map((recent) => (
                <RecentCard key={recent.id} recent={recent} onOpen={onOpenRecent} />
              ))}
            </div>
          </section>
        )}

        <footer className="welcome-footer">
          <span>No accounts. No uploads. No telemetry.</span>
          <span className="welcome-footer-dot" aria-hidden="true" />
          <span>PDF text search, bookmarks, and selection work offline.</span>
        </footer>
      </div>
    </div>
  );
}

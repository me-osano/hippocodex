import { useEffect, useState } from "react";
import type { RecentDocument } from "../types";
import { KIND_LABELS } from "../types";
import { formatBytes, formatRelativeDate, displayPath } from "../lib/format";
import { isSupportedVaultFile, searchVaultFiles } from "../lib/vault";
import type { VaultEntry, VaultInfo } from "../lib/vault";
import { isTauriRuntime } from "../platform/files";
import {
  BrandMark,
  IconClock,
  IconClose,
  IconFile,
  IconFolder,
  IconKeyboard,
  IconLock,
  IconOpen,
  IconSearch,
  IconSettings,
  IconSidebar,
  KindIcon,
} from "./Icons";
import { VaultTree } from "./VaultTree";

export type SidebarTab = "recent" | "files";

interface SidebarProps {
  open: boolean;
  recents: RecentDocument[];
  activeTab: SidebarTab;
  vault: VaultInfo | null;
  onTabChange: (tab: SidebarTab) => void;
  onOpen: () => void;
  onOpenRecent: (recent: RecentDocument) => void;
  onOpenVaultFile: (entry: VaultEntry) => void;
  onRemoveRecent: (id: string) => void;
  onClearRecents: () => void;
  onShowSettings: () => void;
  onSetupVault: () => void;
  onShowHelp: () => void;
  onToggleSidebar: () => void;
  onToast: (message: string, tone?: "info" | "error") => void;
}

export function Sidebar({
  open,
  recents,
  activeTab,
  vault,
  onTabChange,
  onOpen,
  onOpenRecent,
  onOpenVaultFile,
  onRemoveRecent,
  onClearRecents,
  onShowSettings,
  onSetupVault,
  onShowHelp,
  onToggleSidebar,
  onToast,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VaultEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchable = Boolean(vault && isTauriRuntime());

  useEffect(() => {
    setQuery("");
  }, [vault?.path]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !searchable) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    const timer = window.setTimeout(() => {
      searchVaultFiles(trimmed)
        .then((entries) => {
          if (!cancelled) setResults(entries);
        })
        .catch((cause) => {
          if (cancelled) return;
          setResults([]);
          setSearchError(
            cause instanceof Error ? cause.message : "The library could not be searched.",
          );
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, searchable, vault]);

  return (
    <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="Workspace">
      <div className="sidebar-brand-row">
        <div className="brand">
          <span className="brand-mark">
            <BrandMark size={34} />
          </span>
          <div className="brand-copy">
            <span className="brand-name">Hippocodex</span>
            <span className="brand-tagline">local-first study library</span>
          </div>
        </div>
        <button className="icon-button sidebar-toggle" onClick={onToggleSidebar} aria-label="Toggle sidebar" title="Toggle sidebar">
          <IconSidebar size={18} />
        </button>
      </div>

      <button className="open-button" onClick={onOpen}>
        <IconOpen size={18} />
        <span>Open document</span>
        <kbd>Ctrl O</kbd>
      </button>

      <div className="sidebar-search">
        <div className="sidebar-search-field">
          <IconSearch size={15} />
          <input
            type="search"
            aria-label="Search library files"
            placeholder={searchable ? "Search library files" : "Library search"}
            value={query}
            disabled={!searchable}
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value.trim()) onTabChange("files");
            }}
            spellCheck={false}
            autoComplete="off"
          />
          {query && searchable && (
            <button
              className="sidebar-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear library search"
              title="Clear search"
            >
              <IconClose size={13} />
            </button>
          )}
        </div>
        {!searchable && (
          <p className="sidebar-search-hint">
            {vault ? "File search is available in the desktop app." : "Set up a library to search its files."}
          </p>
        )}
      </div>

      <div className="sidebar-tabs" role="tablist" aria-label="Library sections">
        <button
          className={`sidebar-tab ${activeTab === "recent" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "recent"}
          onClick={() => onTabChange("recent")}
        >
          <IconClock size={14} /> Recent
        </button>
        <button
          className={`sidebar-tab ${activeTab === "files" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeTab === "files"}
          onClick={() => onTabChange("files")}
        >
          <IconFolder size={14} /> Files
        </button>
      </div>

      {activeTab === "recent" ? (
        <div className="sidebar-recents" role="tabpanel" aria-label="Recent documents">
          <div className="sidebar-section-heading">
            <span>Recent</span>
            {recents.length > 0 && (
              <button className="text-button" onClick={onClearRecents}>
                Clear
              </button>
            )}
          </div>

          {recents.length === 0 ? (
            <div className="sidebar-empty">
              <p>Nothing here yet.</p>
              <p>Documents you open will appear in this list.</p>
            </div>
          ) : (
            <div className="recent-list">
              {recents.map((recent) => (
                <div className="recent-row" key={recent.id}>
                  <button
                    className="recent-main"
                    onClick={() => onOpenRecent(recent)}
                    title={recent.path ? `${recent.name}\n${recent.path}` : recent.name}
                  >
                    <span className={`recent-icon kind-${recent.kind}`}>
                      <KindIcon kind={recent.kind} size={17} />
                    </span>
                    <span className="recent-copy">
                      <span className="recent-name">{recent.name}</span>
                      <span className="recent-meta">
                        {KIND_LABELS[recent.kind]} · {formatRelativeDate(recent.openedAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    className="recent-remove"
                    onClick={() => onRemoveRecent(recent.id)}
                    aria-label={`Remove ${recent.name} from recents`}
                    title="Remove from recents"
                  >
                    <IconClose size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : query.trim() ? (
        <div className="sidebar-recents" role="tabpanel" aria-label="Library search results">
          <div className="sidebar-section-heading">
            <span>Results for “{query.trim()}”</span>
            <button className="text-button" onClick={() => setQuery("")}>
              Clear
            </button>
          </div>
          {searching && <div className="tree-note">Searching the whole library…</div>}
          {searchError && (
            <div className="tree-note is-error" role="alert">
              {searchError}
            </div>
          )}
          {!searching && !searchError && results.length === 0 && (
            <div className="tree-note">No files match that name or path.</div>
          )}
          {!searching &&
            results.map((entry) => (
              <div className="search-result-row" key={entry.path}>
                <button
                  className={`tree-row ${isSupportedVaultFile(entry.name) ? "is-supported" : ""}`}
                  onClick={() => onOpenVaultFile(entry)}
                  title={entry.absolutePath}
                  style={{ paddingLeft: 6 }}
                >
                  <span className="tree-chevron tree-chevron-empty" />
                  <IconFile size={15} />
                  <span className="tree-name">{entry.name}</span>
                </button>
                <span className="search-result-path" title={entry.path}>
                  {entry.path}
                </span>
              </div>
            ))}
          {!searching && results.length > 0 && (
            <div className="tree-note search-count">
              {results.length} file{results.length === 1 ? "" : "s"} found
            </div>
          )}
        </div>
      ) : (
        <div className="sidebar-recents" role="tabpanel" aria-label="Library files">
          <VaultTree vault={vault} onOpen={onOpenVaultFile} onSetup={onSetupVault} onToast={onToast} />
        </div>
      )}

      <div className="sidebar-footer">
        <div className="privacy-note">
          <IconLock size={15} />
          <span>Files stay on this device.</span>
        </div>
        <div className="sidebar-actions">
          <button className="sidebar-action" onClick={onShowSettings}>
            <IconSettings size={16} />
            <span>Settings</span>
          </button>
          <button className="sidebar-action" onClick={onShowHelp}>
            <IconKeyboard size={16} />
            <span>Shortcuts</span>
          </button>
        </div>
        <div className="sidebar-version">Hippocodex 0.1 · viewer preview</div>
      </div>
    </aside>
  );
}

export function RecentCard({
  recent,
  onOpen,
}: {
  recent: RecentDocument;
  onOpen: (recent: RecentDocument) => void;
}) {
  return (
    <button className="recent-card" onClick={() => onOpen(recent)} title={displayPath(recent.path) ?? recent.name}>
      <span className={`recent-card-icon kind-${recent.kind}`}>
        <KindIcon kind={recent.kind} size={20} />
      </span>
      <span className="recent-card-body">
        <span className="recent-card-name">{recent.name}</span>
        <span className="recent-card-meta">
          {KIND_LABELS[recent.kind]} · {formatBytes(recent.size)} · {formatRelativeDate(recent.openedAt)}
        </span>
        {recent.path && <span className="recent-card-path">{displayPath(recent.path)}</span>}
      </span>
    </button>
  );
}

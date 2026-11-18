import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { OpenDocument, FileSource, RecentDocument } from "./types";
import { KIND_LABELS } from "./types";
import { detectFileType, UnsupportedFileError } from "./lib/filetype";
import { formatBytes, displayPath } from "./lib/format";
import { encodeUtf8 } from "./lib/text";
import {
  addRecent,
  clearRecents as clearStoredRecents,
  loadRecents,
  removeRecent,
} from "./lib/recents";
import {
  browserFilesFromDrop,
  getSessionFile,
  hasFilePayload,
  isTauriRuntime,
  pickFiles,
  readSource,
  rememberSessionFile,
  sessionFileKey,
  sourceFromPath,
  subscribeToDesktopFileDrop,
} from "./platform/files";
import { isExternalUrl, openExternal } from "./platform/external";
import { useMediaQuery, usePersistentAppearance, usePersistentTabs, useToast, useVault } from "./hooks";
import { isVaultPath, updateVaultNote, vaultSource } from "./lib/vault";
import type { VaultEntry, VaultInfo } from "./lib/vault";
import { isEditableNote, noteExtension } from "./lib/notes";
import type { CreatedNoteResult } from "./lib/notes";
import { Sidebar } from "./components/Sidebar";
import type { SidebarTab } from "./components/Sidebar";
import { VaultWizard } from "./components/VaultWizard";
import { Welcome } from "./components/Welcome";
import { Viewer } from "./components/Viewer";
import { ShortcutHelp } from "./components/ShortcutHelp";
import { SettingsPanel } from "./components/SettingsPanel";
import { NewNoteDialog } from "./components/NewNoteDialog";
import { IconAlert, IconClose, IconFile, IconOpen, IconPlus, IconSidebar, KindIcon } from "./components/Icons";

export default function App() {
  const appearance = usePersistentAppearance();
  const { tabsEnabled, toggleTabs } = usePersistentTabs();
  const { toast, show, dismiss } = useToast();
  const vaultState = useVault();
  const isMobile = useMediaQuery("(max-width: 900px)");

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("recent");
  const [recents, setRecents] = useState<RecentDocument[]>(loadRecents);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState<{ name: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const dragDepth = useRef(0);
  const loadingRef = useRef(false);
  const doc = openDocuments.find((item) => item.id === activeDocumentId) ?? null;

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const openSources = useCallback(
    async (sources: FileSource[]) => {
      if (sources.length === 0 || loadingRef.current) return;
      if (sources.length > 1) {
        show("Opened the first file. Multiple tabs are coming in a later milestone.");
      }
      const source = sources[0];
      loadingRef.current = true;
      setLoading({ name: source.name });

      try {
        const opened = await readSource(source);
        const detected = detectFileType(opened.name, opened.bytes);
        const lastModified = opened.lastModified ?? Date.now();
        const sessionKey =
          source.kind === "file" ? sessionFileKey(opened.name, opened.size, lastModified) : null;
        if (source.kind === "file" && source.file) rememberSessionFile(source.file);

        const id = source.kind === "path" && source.path ? source.path : (sessionKey ?? `session:${opened.name}`);
        const nextDoc: OpenDocument = {
          id,
          name: opened.name,
          size: opened.size,
          kind: detected.kind,
          language: detected.language,
          bytes: opened.bytes,
          path: source.kind === "path" ? source.path : undefined,
          openedAt: Date.now(),
        };
        const recent: RecentDocument = {
          id,
          name: opened.name,
          size: opened.size,
          kind: detected.kind,
          path: source.kind === "path" ? source.path : undefined,
          openedAt: Date.now(),
        };

        setOpenDocuments((current) => {
          if (!tabsEnabled) return [nextDoc];
          return [...current.filter((item) => item.id !== nextDoc.id), nextDoc];
        });
        setActiveDocumentId(nextDoc.id);
        setRecents((current) => addRecent(current, recent));
        if (isMobile) setSidebarOpen(false);
        if (detected.reason && detected.kind === "text" && !detected.extension) {
          show("Opened as plain text. The file has no extension.");
        }
      } catch (error) {
        if (error instanceof UnsupportedFileError) show(error.message, "error");
        else show(error instanceof Error ? error.message : "The document could not be opened.", "error");
      } finally {
        loadingRef.current = false;
        setLoading(null);
      }
    },
    [isMobile, show, tabsEnabled],
  );

  const closeDocument = useCallback(
    (id: string) => {
      setOpenDocuments((current) => {
        const index = current.findIndex((item) => item.id === id);
        const next = current.filter((item) => item.id !== id);
        if (id === activeDocumentId) {
          setActiveDocumentId(next[Math.max(0, index - 1)]?.id ?? null);
        }
        return next;
      });
    },
    [activeDocumentId],
  );

  const handleOpen = useCallback(async () => {
    if (loadingRef.current) return;
    try {
      const sources = await pickFiles();
      await openSources(sources);
    } catch (error) {
      show(error instanceof Error ? error.message : "The file picker could not be opened.", "error");
    }
  }, [openSources, show]);

  const handleNoteCreated = useCallback(
    (result: CreatedNoteResult) => {
      setNewNoteOpen(false);
      show(
        result.saved
          ? `Created ${result.source.name} in your Library.`
          : `Created ${result.source.name} for this session only. Browser preview can't write to disk.`,
      );
      void openSources([result.source]);
    },
    [openSources, show],
  );

  const handleSaveNote = useCallback(
    async (target: OpenDocument, text: string): Promise<boolean> => {
      const bytes = encodeUtf8(text);
      const libraryPath = vaultState.vault?.path ?? null;

      if (target.path && isVaultPath(target.path, libraryPath)) {
        try {
          await updateVaultNote(target.path, text);
        } catch (error) {
          show(error instanceof Error ? error.message : "The note could not be saved.", "error");
          return false;
        }
        const updated: OpenDocument = {
          ...target,
          bytes,
          size: bytes.byteLength,
          openedAt: Date.now(),
        };
        setOpenDocuments((current) =>
          current.map((item) => (item.id === target.id ? updated : item)),
        );
        setRecents((current) =>
          addRecent(removeRecent(current, target.id), {
            id: target.id,
            name: target.name,
            size: updated.size,
            kind: target.kind,
            path: target.path,
            openedAt: updated.openedAt,
          }),
        );
        show("Saved to your Library.");
        return true;
      }

      // Browser notes have no disk path: replace the in-memory File and its
      // session key so Recents can still find the edited content.
      const file = new File([text], target.name, {
        type: noteExtension(target.name) === "md" ? "text/markdown" : "text/plain",
        lastModified: Date.now(),
      });
      rememberSessionFile(file);
      const id = sessionFileKey(file.name, file.size, file.lastModified);
      const updated: OpenDocument = {
        ...target,
        id,
        bytes,
        size: file.size,
        openedAt: Date.now(),
      };
      setOpenDocuments((current) =>
        current.map((item) => (item.id === target.id ? updated : item)),
      );
      setActiveDocumentId((current) => (current === target.id ? id : current));
      setRecents((current) =>
        addRecent(removeRecent(current, target.id), {
          id,
          name: target.name,
          size: target.size,
          kind: target.kind,
          openedAt: updated.openedAt,
        }),
      );
      show("Saved for this session. Browser preview cannot write to disk.");
      return true;
    },
    [show, vaultState.vault],
  );

  const handleOpenRecent = useCallback(
    (recent: RecentDocument) => {
      if (recent.path) {
        void openSources([sourceFromPath(recent.path)]);
        return;
      }
      const file = getSessionFile(recent.id);
      if (file) {
        void openSources([{ kind: "file", file, name: file.name }]);
      } else {
        show("Browser files are session-only. Open this file from disk again after a reload.", "error");
      }
    },
    [openSources, show],
  );

  const handleRemoveRecent = useCallback((id: string) => {
    setRecents((current) => removeRecent(current, id));
  }, []);

  const handleClearRecents = useCallback(() => {
    setRecents(clearStoredRecents());
    show("Recent documents cleared.");
  }, [show]);

  const handleOpenVaultFile = useCallback(
    (entry: VaultEntry) => {
      void openSources([vaultSource(entry)]);
    },
    [openSources],
  );

  const handleVaultComplete = useCallback(
    (_info: VaultInfo) => {
      vaultState.completeVault(_info);
      setSidebarTab("files");
      if (!isMobile) setSidebarOpen(true);
    },
    [isMobile, vaultState],
  );

  const handleChangeVault = useCallback(() => {
    setSettingsOpen(false);
    vaultState.openWizard();
  }, [vaultState]);

  const handleClearVault = useCallback(() => {
    setSettingsOpen(false);
    void vaultState.forgetVault().then(() => {
      setSidebarTab("recent");
      show("Library folder cleared. Choose a new one whenever you're ready.");
    });
  }, [show, vaultState]);

  useEffect(() => {
    let subscription: { unlisten: () => void } | null = null;
    let disposed = false;

    void subscribeToDesktopFileDrop(
      () => setDragging(true),
      () => setDragging(false),
      (paths) => {
        void openSources(paths.map(sourceFromPath));
      },
    ).then((result) => {
      if (disposed) result?.unlisten();
      else subscription = result;
    });

    return () => {
      disposed = true;
      subscription?.unlisten();
    };
  }, [openSources]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void handleOpen();
        return;
      }
      if (mod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNewNoteOpen(true);
        return;
      }
      if (event.key === "?" && !typing) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (event.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        if (settingsOpen) setSettingsOpen(false);
        if (newNoteOpen) setNewNoteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpen, helpOpen, settingsOpen, newNoteOpen]);

  // External links belong in the real browser, not in the local viewer. This
  // also covers links inside rendered Markdown and DOCX content.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const origin = event.target as Element | null;
      const anchor = origin?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute("href");
      if (!href || !isExternalUrl(href)) return;
      event.preventDefault();
      void openExternal(href).catch(() => show("This link could not be opened.", "error"));
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [show]);

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFilePayload(event.nativeEvent)) return;
    event.preventDefault();
    dragDepth.current += 1;
    if (!isTauriRuntime()) setDragging(true);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFilePayload(event.nativeEvent)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const sources = browserFilesFromDrop(event.nativeEvent);
    if (sources.length > 0 && !isTauriRuntime()) void openSources(sources);
  };

  return (
    <div
      className={`app-shell ${sidebarOpen ? "is-sidebar-open" : ""} ${isMobile ? "is-mobile" : ""}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isMobile && sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <Sidebar
        open={sidebarOpen}
        recents={recents}
        activeTab={sidebarTab}
        vault={vaultState.vault}
        onTabChange={setSidebarTab}
        onOpen={handleOpen}
        onOpenRecent={handleOpenRecent}
        onOpenVaultFile={handleOpenVaultFile}
        onRemoveRecent={handleRemoveRecent}
        onClearRecents={handleClearRecents}
        onShowSettings={() => setSettingsOpen(true)}
        onSetupVault={handleChangeVault}
        onShowHelp={() => setHelpOpen(true)}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onToast={show}
      />

      <main className="workspace">
        <header className="document-header">
          <div className="document-heading">
            {!sidebarOpen && (
              <button
                className="icon-button header-sidebar-toggle"
                onClick={() => setSidebarOpen(true)}
                aria-label="Toggle sidebar"
                title="Toggle sidebar"
              >
                <IconSidebar size={18} />
              </button>
            )}

            {tabsEnabled && openDocuments.length > 0 ? (
              <div className="document-tabs" role="tablist" aria-label="Open documents">
                {openDocuments.map((tab) => (
                  <button
                    key={tab.id}
                    className={`document-tab ${tab.id === activeDocumentId ? "is-active" : ""}`}
                    role="tab"
                    aria-selected={tab.id === activeDocumentId}
                    onClick={() => setActiveDocumentId(tab.id)}
                    title={tab.path ?? tab.name}
                  >
                    <KindIcon kind={tab.kind} size={16} />
                    <span>{tab.name}</span>
                    <span
                      className="document-tab-close"
                      role="button"
                      aria-label={`Close ${tab.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeDocument(tab.id);
                      }}
                    >
                      <IconClose size={13} />
                    </span>
                  </button>
                ))}
              </div>
            ) : doc ? (
              <>
                <span className={`document-icon kind-${doc.kind}`}>
                  <KindIcon kind={doc.kind} size={19} />
                </span>
                <div className="document-title-group">
                  <h1 title={doc.name}>{doc.name}</h1>
                  <span className="document-meta">
                    {KIND_LABELS[doc.kind]} · {formatBytes(doc.size)}
                    {doc.path ? ` · ${displayPath(doc.path)}` : ""}
                  </span>
                </div>
              </>
            ) : (
              <div className="document-title-group">
                <h1 className="document-placeholder-title">
                  <IconFile size={18} /> Workspace
                </h1>
                <span className="document-meta">Local documents · nothing uploaded</span>
              </div>
            )}
          </div>

          <div className="document-actions">
            <button
              className="btn-secondary new-note"
              onClick={() => setNewNoteOpen(true)}
              title="Create a note (Ctrl/⌘ + N)"
            >
              <IconPlus size={16} />
              New note
            </button>
            {doc ? (
              <button className="btn-secondary close-document" onClick={() => closeDocument(doc.id)} title="Close document">
                <IconClose size={16} />
                Close
              </button>
            ) : (
              <button className="btn-secondary open-secondary" onClick={handleOpen}>
                <IconOpen size={16} />
                Open
              </button>
            )}
          </div>
        </header>

        <div className="workspace-content">
          {openDocuments.length === 0 && !loading && (
            <Welcome recents={recents} onOpen={handleOpen} onOpenRecent={handleOpenRecent} />
          )}
          {doc && (
            <Viewer
              doc={doc}
              onClose={() => closeDocument(doc.id)}
              onToast={show}
              canEdit={isEditableNote(doc, vaultState.vault?.path ?? null)}
              onSaveNote={handleSaveNote}
            />
          )}
          {loading && (
            <div className={`loading-overlay ${doc ? "over-document" : ""}`}>
              <div className="loading-card">
                <span className="spinner" aria-hidden="true" />
                <div>
                  <p>Opening {loading.name}</p>
                  <span>Reading from disk. Nothing leaves your machine.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-card">
            <span className="drop-overlay-icon">
              <IconOpen size={34} />
            </span>
            <strong>Drop to open</strong>
            <span>PDF, Markdown, text, code, CSV, DOCX, PowerPoint, or an image</span>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.tone === "error" ? "is-error" : ""}`} role="status">
          <span className="toast-icon">
            {toast.tone === "error" ? <IconAlert size={17} /> : <IconFile size={17} />}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={dismiss} aria-label="Dismiss message">
            <IconClose size={14} />
          </button>
        </div>
      )}

      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
      {newNoteOpen && (
        <NewNoteDialog
          libraryPath={vaultState.vault?.path ?? null}
          onCreated={handleNoteCreated}
          onClose={() => setNewNoteOpen(false)}
        />
      )}
      {settingsOpen && (
        <SettingsPanel
          theme={appearance.theme}
          defaultMode={appearance.defaultMode}
          glass={appearance.glass}
          reduceEffects={appearance.reduceEffects}
          tabsEnabled={tabsEnabled}
          vault={vaultState.vault}
          onTheme={appearance.setTheme}
          onDefaultMode={appearance.setDefaultMode}
          onToggleGlass={appearance.toggleGlass}
          onToggleReduceEffects={appearance.toggleReduceEffects}
          onToggleTabs={toggleTabs}
          onChangeVault={handleChangeVault}
          onClearVault={handleClearVault}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {vaultState.ready && vaultState.wizardOpen && (
        <VaultWizard
          current={vaultState.vault}
          onComplete={handleVaultComplete}
          onClose={vaultState.closeWizard}
          onToast={show}
        />
      )}
    </div>
  );
}

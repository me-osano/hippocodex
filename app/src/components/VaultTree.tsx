import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { isSupportedVaultFile, listVaultEntries } from "../lib/vault";
import type { VaultEntry, VaultInfo } from "../lib/vault";
import { isTauriRuntime } from "../platform/files";
import {
  IconChevronDown,
  IconChevronRight,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconRefresh,
  IconVault,
} from "./Icons";

interface VaultTreeProps {
  vault: VaultInfo | null;
  onOpen: (entry: VaultEntry) => void;
  onSetup: () => void;
  onToast: (message: string, tone?: "info" | "error") => void;
}

export function VaultTree({ vault, onOpen, onSetup, onToast }: VaultTreeProps) {
  const [roots, setRoots] = useState<VaultEntry[] | null>(null);
  const [children, setChildren] = useState<Map<string, VaultEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!vault) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await listVaultEntries("");
      setRoots(entries);
      setChildren(new Map());
      setExpanded(new Set());
    } catch (cause) {
      setRoots([]);
      setError(cause instanceof Error ? cause.message : "The library could not be listed.");
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggle = async (entry: VaultEntry) => {
    const isOpen = expanded.has(entry.path);
    setExpanded((current) => {
      const next = new Set(current);
      if (isOpen) next.delete(entry.path);
      else next.add(entry.path);
      return next;
    });
    if (isOpen || children.has(entry.path) || loadingDirs.has(entry.path)) return;

    setLoadingDirs((current) => new Set(current).add(entry.path));
    try {
      const entries = await listVaultEntries(entry.path);
      setChildren((current) => new Map(current).set(entry.path, entries));
    } catch (cause) {
      onToast(cause instanceof Error ? cause.message : "This folder could not be listed.", "error");
    } finally {
      setLoadingDirs((current) => {
        const next = new Set(current);
        next.delete(entry.path);
        return next;
      });
    }
  };

  const renderEntry = (entry: VaultEntry, depth: number): ReactNode => {
    const isDirectory = entry.kind === "directory";
    const isOpen = expanded.has(entry.path);
    const nested = children.get(entry.path);
    const supported = !isDirectory && isSupportedVaultFile(entry.name);

    return (
      <div key={entry.path} className="tree-branch">
        <button
          className={`tree-row ${isDirectory ? "is-directory" : ""} ${isOpen ? "is-expanded" : ""} ${
            supported ? "is-supported" : ""
          }`}
          style={{ paddingLeft: 6 + depth * 13 }}
          onClick={() => (isDirectory ? void toggle(entry) : onOpen(entry))}
          title={entry.absolutePath}
          aria-expanded={isDirectory ? isOpen : undefined}
        >
          {isDirectory ? (
            <span className="tree-chevron">
              {isOpen ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
            </span>
          ) : (
            <span className="tree-chevron tree-chevron-empty" />
          )}
          {isDirectory ? (
            isOpen ? <IconFolderOpen size={15} /> : <IconFolder size={15} />
          ) : (
            <IconFile size={15} />
          )}
          <span className="tree-name">{entry.name}</span>
        </button>
        {isDirectory && isOpen && (
          <div className="tree-children">
            {loadingDirs.has(entry.path) && <div className="tree-note">Loading…</div>}
            {!loadingDirs.has(entry.path) && nested?.length === 0 && (
              <div className="tree-note" style={{ paddingLeft: 6 + (depth + 1) * 13 }}>
                Empty folder
              </div>
            )}
            {nested?.map((child) => renderEntry(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!vault) {
    return (
      <div className="sidebar-empty vault-empty">
        <IconVault size={22} />
        <p>No library folder yet.</p>
        <p>Choose one to browse your study files here.</p>
        <button className="btn-secondary" onClick={onSetup}>
          Set up library
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar-vault">
      <div className="sidebar-section-heading">
        <span title={vault.path}>{vault.name}</span>
        <button
          className="text-button vault-refresh"
          onClick={() => void reload()}
          title="Refresh library tree"
          aria-label="Refresh library tree"
          disabled={loading}
        >
          <IconRefresh size={13} />
        </button>
      </div>
      <div className="vault-path-line" title={vault.path}>
        {vault.path}
      </div>

      {loading && <div className="tree-note">Reading folder…</div>}
      {error && (
        <div className="tree-note is-error" role="alert">
          {error}
        </div>
      )}
      {!isTauriRuntime() && (
        <div className="tree-note">Folder browsing is available in the desktop app.</div>
      )}
      {!loading && !error && roots?.length === 0 && (
        <div className="tree-note">This folder is empty. Add papers or notes to see them here.</div>
      )}
      <div className="vault-tree-list">{roots?.map((entry) => renderEntry(entry, 0))}</div>
    </div>
  );
}

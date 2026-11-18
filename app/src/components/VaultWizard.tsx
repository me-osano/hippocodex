import { useEffect, useRef, useState } from "react";
import {
  chooseVaultFolder,
  configureVault,
  createVaultFolder,
  suggestVaultPath,
  validateVaultPath,
} from "../lib/vault";
import type { VaultInfo } from "../lib/vault";
import { isTauriRuntime } from "../platform/files";
import {
  IconArrowRight,
  IconCheck,
  IconClose,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconLock,
  IconVault,
} from "./Icons";

interface VaultWizardProps {
  current: VaultInfo | null;
  onComplete: (info: VaultInfo) => void;
  onClose: () => void;
  onToast: (message: string, tone?: "info" | "error") => void;
}

type Step = "intro" | "choose" | "done";
type Mode = "existing" | "new";

export function VaultWizard({ current, onComplete, onClose, onToast }: VaultWizardProps) {
  const [step, setStep] = useState<Step>("intro");
  const [mode, setMode] = useState<Mode>("existing");
  const [path, setPath] = useState(current?.path ?? "");
  const [completed, setCompleted] = useState<VaultInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    nextRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && current) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, onClose]);

  useEffect(() => {
    if (path) return;
    void suggestVaultPath()
      .then((suggested) => setPath((value) => value || suggested))
      .catch(() => undefined);
  }, [path]);

  const handleBrowse = async () => {
    setError(null);
    try {
      const picked = await chooseVaultFolder();
      if (picked) {
        setMode("existing");
        setPath(picked);
      } else if (!isTauriRuntime()) {
        onToast("Type or paste a folder path in the browser preview.", "error");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The folder picker could not be opened.");
    }
  };

  const handleContinue = async () => {
    const trimmed = path.trim();
    if (!trimmed) {
      setError("Choose or enter a folder path.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const checked =
        mode === "new"
          ? await createVaultFolder(trimmed)
          : await validateVaultPath(trimmed);
      const info = await configureVault(checked.path);
      setCompleted(info);
      setStep("done");
      onToast(`Library ready: ${info.name}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This folder could not be used as a library.");
    } finally {
      setBusy(false);
    }
  };

  // A narrow alias keeps TypeScript from losing the non-null check inside callbacks.
  const finished = completed;

  return (
    <div className="modal-backdrop wizard-backdrop">
      <section className="modal wizard-modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <div className="wizard-topline">
          <span className="wizard-brand">
            <IconVault size={18} /> Hippocodex setup
          </span>
          {current && (
            <button className="icon-button" onClick={onClose} aria-label="Close setup">
              <IconClose size={17} />
            </button>
          )}
        </div>

        <div className="wizard-progress" aria-label={`Step ${step === "intro" ? 1 : step === "choose" ? 2 : 3} of 3`}>
          {(["intro", "choose", "done"] as const).map((item, index) => {
            const order = { intro: 0, choose: 1, done: 2 };
            return (
              <span
                key={item}
                className={`wizard-progress-step ${order[step] >= index ? "is-current" : ""}`}
              >
                <span>{order[step] > index ? <IconCheck size={11} strokeWidth={2.6} /> : index + 1}</span>
              </span>
            );
          })}
        </div>

        {step === "intro" && (
          <div className="wizard-body">
            <span className="wizard-hero-icon">
              <IconVault size={34} />
            </span>
            <h2 id="wizard-title">Your library starts with a folder</h2>
            <p className="wizard-lede">
              Pick one folder on this device as your library. Hippocodex can browse it freely, so your
              papers and notes are always one click away — without uploading anything.
            </p>
            <div className="wizard-points">
              <div>
                <IconFolderOpen size={19} />
                <span>
                  <strong>Browse the whole tree</strong>
                  <small>Files appear in the new Files tab in the sidebar.</small>
                </span>
              </div>
              <div>
                <IconLock size={19} />
                <span>
                  <strong>Stays on this device</strong>
                  <small>No account, no sync, no training data leaves your machine.</small>
                </span>
              </div>
              <div>
                <IconFolder size={19} />
                <span>
                  <strong>Change it any time</strong>
                  <small>Settings → Library directory lets you point somewhere else.</small>
                </span>
              </div>
            </div>
          </div>
        )}

        {step === "choose" && (
          <div className="wizard-body">
            <h2 id="wizard-title">Choose your library folder</h2>
            <p className="wizard-lede">
              Use a folder you already keep notes in, or let Hippocodex create a fresh one.
            </p>

            <div className="wizard-modes" role="group" aria-label="Library folder mode">
              <button
                className={`wizard-mode ${mode === "existing" ? "is-selected" : ""}`}
                onClick={() => setMode("existing")}
                aria-pressed={mode === "existing"}
              >
                <IconFolderOpen size={20} />
                <span>
                  <strong>Existing folder</strong>
                  <small>Read and browse what's already there.</small>
                </span>
              </button>
              <button
                className={`wizard-mode ${mode === "new" ? "is-selected" : ""}`}
                onClick={() => setMode("new")}
                aria-pressed={mode === "new"}
              >
                <IconFolderPlus size={20} />
                <span>
                  <strong>New folder</strong>
                  <small>Create a dedicated library in one click.</small>
                </span>
              </button>
            </div>

            <label className="wizard-field" htmlFor="wizard-path">
              <span>{mode === "new" ? "New folder path" : "Folder path"}</span>
              <div className="wizard-path-row">
                <input
                  id="wizard-path"
                  value={path}
                  onChange={(event) => {
                    setPath(event.target.value);
                    setError(null);
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="/home/you/Documents/Study files"
                />
                <button className="btn-secondary" onClick={() => void handleBrowse()} type="button">
                  <IconFolder size={16} /> Browse
                </button>
              </div>
            </label>

            {error && <p className="wizard-error" role="alert">{error}</p>}
            {!isTauriRuntime() && (
              <p className="wizard-hint">
                Browser preview: enter a path to save the setting. Folder browsing and tree listing
                become available in the desktop app.
              </p>
            )}
          </div>
        )}

        {step === "done" && finished && (
          <div className="wizard-body wizard-done">
            <span className="wizard-hero-icon is-success">
              <IconCheck size={32} strokeWidth={2.2} />
            </span>
            <h2 id="wizard-title">Library ready</h2>
            <p className="wizard-lede">
              Hippocodex now has access to <strong>{completed.name}</strong>. Open the Files tab to
              browse it, or keep using Open document for anything else.
            </p>
            <div className="wizard-path-preview" title={completed.path}>
              <IconFolder size={16} /> {completed.path}
            </div>
          </div>
        )}

        <div className="wizard-footer">
          {step === "intro" && (
            <>
              {current && (
                <button className="btn-ghost" onClick={onClose}>
                  Not now
                </button>
              )}
              <button ref={nextRef} className="btn-primary" onClick={() => setStep("choose")}>
                Get started <IconArrowRight size={16} />
              </button>
            </>
          )}
          {step === "choose" && (
            <>
              <button className="btn-ghost" onClick={() => setStep("intro")} disabled={busy}>
                Back
              </button>
              <button ref={nextRef} className="btn-primary" onClick={() => void handleContinue()} disabled={busy}>
                {busy ? "Preparing…" : mode === "new" ? "Create library" : "Use this folder"}
                <IconArrowRight size={16} />
              </button>
            </>
          )}
          {step === "done" && finished && (
            <button ref={nextRef} className="btn-primary" onClick={() => onComplete(finished)}>
              Open my library <IconArrowRight size={16} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

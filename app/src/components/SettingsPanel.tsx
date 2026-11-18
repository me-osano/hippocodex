import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { DefaultMode, ThemeId } from "../lib/theme";
import { THEMES } from "../lib/theme";
import type { VaultInfo } from "../lib/vault";
import { IconCheck, IconClose, IconFolder, IconGlass, IconPalette, IconVault } from "./Icons";

interface SettingsPanelProps {
  theme: ThemeId;
  defaultMode: DefaultMode;
  glass: boolean;
  reduceEffects: boolean;
  tabsEnabled: boolean;
  vault: VaultInfo | null;
  onTheme: (theme: ThemeId) => void;
  onDefaultMode: (mode: DefaultMode) => void;
  onToggleGlass: () => void;
  onToggleReduceEffects: () => void;
  onToggleTabs: () => void;
  onChangeVault: () => void;
  onClearVault: () => void;
  onClose: () => void;
}

const MODES: ReadonlyArray<{ id: DefaultMode; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function swatchStyle(theme: (typeof THEMES)[number]): CSSProperties {
  return {
    "--swatch-bg": theme.swatch.bg,
    "--swatch-surface": theme.swatch.surface,
    "--swatch-ink": theme.swatch.ink,
    "--swatch-accent": theme.swatch.accent,
    "--swatch-dark-bg": theme.swatch.darkBg ?? theme.swatch.bg,
    "--swatch-dark-surface": theme.swatch.darkSurface ?? theme.swatch.surface,
    "--swatch-dark-accent": theme.swatch.darkAccent ?? theme.swatch.accent,
  } as CSSProperties;
}

export function SettingsPanel({
  theme,
  defaultMode,
  glass,
  reduceEffects,
  tabsEnabled,
  vault,
  onTheme,
  onDefaultMode,
  onToggleGlass,
  onToggleReduceEffects,
  onToggleTabs,
  onChangeVault,
  onClearVault,
  onClose,
}: SettingsPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-header">
          <div>
            <span className="settings-kicker">Preferences</span>
            <h2 id="settings-title">
              <IconPalette size={20} /> Settings
            </h2>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close settings">
            <IconClose size={18} />
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-section-heading">
            <div>
              <h3>Library directory</h3>
              <p>The local folder Hippocodex can browse in the Files tab.</p>
            </div>
          </div>

          <div className="vault-setting-card">
            <span className="vault-setting-icon">
              <IconVault size={20} />
            </span>
            <div className="vault-setting-copy">
              <strong>{vault ? vault.name : "No folder selected"}</strong>
              <span title={vault?.path}>
                {vault ? vault.path : "Choose a folder to browse your study files."}
              </span>
              {vault && !vault.writable && <small>Browser preview — folder access needs the desktop app.</small>}
            </div>
            <div className="vault-setting-actions">
              <button className="btn-secondary" onClick={onChangeVault}>
                <IconFolder size={15} /> {vault ? "Change" : "Choose"}
              </button>
              {vault && (
                <button className="btn-ghost" onClick={onClearVault}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-heading">
            <div>
              <h3>Appearance</h3>
              <p>Personalize how Hippocodex looks while you read.</p>
            </div>
          </div>

          <div className="theme-grid settings-theme-grid" role="group" aria-label="Theme">
            {THEMES.map((option) => {
              const selected = option.id === theme;
              return (
                <button
                  key={option.id}
                  className={`theme-option ${selected ? "is-selected" : ""}`}
                  style={swatchStyle(option)}
                  onClick={() => onTheme(option.id)}
                  aria-pressed={selected}
                  title={option.description}
                >
                  <span className={`theme-swatch ${option.id === "default" ? "is-split" : ""}`} aria-hidden="true">
                    {selected && (
                      <span className="theme-swatch-check">
                        <IconCheck size={10} strokeWidth={2.4} />
                      </span>
                    )}
                  </span>
                  <span className="theme-option-name">{option.name}</span>
                </button>
              );
            })}
          </div>

          {theme === "default" && (
            <div className="appearance-mode">
              <span className="appearance-mode-label">Paper or ink</span>
              <div className="segmented appearance-mode-control" role="group" aria-label="Default theme mode">
                {MODES.map((mode) => (
                  <button
                    key={mode.id}
                    className={defaultMode === mode.id ? "is-active" : ""}
                    onClick={() => onDefaultMode(mode.id)}
                    aria-pressed={defaultMode === mode.id}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="settings-options">
            <button className="settings-option" role="switch" aria-checked={glass} onClick={onToggleGlass}>
              <IconGlass size={18} />
              <span className="glass-copy">
                <strong>Frosted glass</strong>
                <span>Translucent surfaces with a soft blur.</span>
              </span>
              <span className={`switch ${glass ? "is-on" : ""}`} aria-hidden="true" />
            </button>
            <button className="settings-option" role="switch" aria-checked={reduceEffects} onClick={onToggleReduceEffects}>
              <span className="settings-option-symbol" aria-hidden="true">◌</span>
              <span className="glass-copy">
                <strong>Reduce effects</strong>
                <span>Disable grain and blur for better performance.</span>
              </span>
              <span className={`switch ${reduceEffects ? "is-on" : ""}`} aria-hidden="true" />
            </button>
            <button className="settings-option" role="switch" aria-checked={tabsEnabled} onClick={onToggleTabs}>
              <span className="settings-option-symbol" aria-hidden="true">▤</span>
              <span className="glass-copy">
                <strong>Show document tabs</strong>
                <span>Keep multiple open documents available in the top bar.</span>
              </span>
              <span className={`switch ${tabsEnabled ? "is-on" : ""}`} aria-hidden="true" />
            </button>
          </div>
        </div>

      </section>
    </div>
  );
}

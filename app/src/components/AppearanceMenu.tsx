import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DefaultMode, ThemeId } from "../lib/theme";
import { THEMES } from "../lib/theme";
import { IconCheck, IconClose, IconGlass, IconPalette } from "./Icons";

interface AppearanceMenuProps {
  theme: ThemeId;
  defaultMode: DefaultMode;
  glass: boolean;
  reduceEffects: boolean;
  onTheme: (theme: ThemeId) => void;
  onDefaultMode: (mode: DefaultMode) => void;
  onToggleGlass: () => void;
  onToggleReduceEffects: () => void;
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

export function AppearanceMenu({
  theme,
  defaultMode,
  glass,
  reduceEffects,
  onTheme,
  onDefaultMode,
  onToggleGlass,
  onToggleReduceEffects,
}: AppearanceMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const current = THEMES.find((option) => option.id === theme) ?? THEMES[0];

  return (
    <div className="appearance-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        className={`sidebar-action appearance-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="appearance-panel"
        title={`Appearance: ${current.name}`}
      >
        <IconPalette size={16} />
        <span>Appearance</span>
        <span className={`appearance-dot appearance-dot-${theme}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="appearance-popover" id="appearance-panel" role="dialog" aria-label="Appearance">
          <div className="appearance-heading">
            <span>Theme</span>
            <button
              ref={closeRef}
              className="icon-button appearance-close"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close appearance settings"
            >
              <IconClose size={14} />
            </button>
          </div>

          <div className="theme-grid" role="group" aria-label="Theme">
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
                  <span
                    className={`theme-swatch ${option.id === "default" ? "is-split" : ""}`}
                    aria-hidden="true"
                  >
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

          <div className="appearance-divider" />

          <button
            className="glass-row"
            role="switch"
            aria-checked={glass}
            onClick={onToggleGlass}
          >
            <IconGlass size={16} />
            <span className="glass-copy">
              <strong>Frosted glass</strong>
              <span>Translucent surfaces with a soft blur.</span>
            </span>
            <span className={`switch ${glass ? "is-on" : ""}`} aria-hidden="true" />
          </button>
          <button
            className="glass-row"
            role="switch"
            aria-checked={reduceEffects}
            onClick={onToggleReduceEffects}
          >
            <span aria-hidden="true">◌</span>
            <span className="glass-copy">
              <strong>Reduce effects</strong>
              <span>Disable grain and blur for better performance.</span>
            </span>
            <span className={`switch ${reduceEffects ? "is-on" : ""}`} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

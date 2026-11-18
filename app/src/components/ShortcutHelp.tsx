import { useEffect, useRef } from "react";
import { IconClose, IconKeyboard } from "./Icons";

interface ShortcutHelpProps {
  onClose: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

const GROUPS = [
  {
    title: "General",
    shortcuts: [
      { keys: [mod, "O"], label: "Open a document" },
      { keys: [mod, "N"], label: "Create a note" },
      { keys: ["?"], label: "Show this shortcut sheet" },
      { keys: ["Esc"], label: "Close menus and panels" },
    ],
  },
  {
    title: "Note editor",
    shortcuts: [
      { keys: [mod, "S"], label: "Save the note" },
      { keys: ["Esc"], label: "Cancel edits" },
    ],
  },
  {
    title: "PDF viewer",
    shortcuts: [
      { keys: [mod, "F"], label: "Search the document" },
      { keys: ["←", "→"], label: "Previous / next page" },
      { keys: ["PgUp", "PgDn"], label: "Previous / next page" },
      { keys: ["Home", "End"], label: "First / last page" },
      { keys: ["+", "−"], label: "Zoom in / out" },
      { keys: ["0"], label: "Fit page width" },
    ],
  },
  {
    title: "Presentation viewer",
    shortcuts: [{ keys: ["←", "→"], label: "Previous / next slide" }],
  },
];

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="shortcut-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              <IconKeyboard size={14} /> Keyboard
            </span>
            <h2 id="shortcut-title">Move without the mouse.</h2>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close shortcuts">
            <IconClose size={18} />
          </button>
        </div>

        <div className="shortcut-groups">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.shortcuts.map((shortcut, index) => (
                  <div className="shortcut-row" key={`${shortcut.label}-${index}`}>
                    <dt>{shortcut.label}</dt>
                    <dd>
                      {shortcut.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <p className="modal-footnote">
          Most shortcuts work when focus is not inside a text field. {mod} + S works while editing a
          note. Everything runs locally.
        </p>
      </div>
    </div>
  );
}

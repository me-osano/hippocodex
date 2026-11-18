import { isTauriRuntime } from "./files";

const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * True only for absolute web/email links. Relative links and in-document
 * anchors stay inside the viewer.
 */
export function isExternalUrl(href: string): boolean {
  if (!href) return false;
  try {
    const url = new URL(href, window.location.href);
    return EXTERNAL_PROTOCOLS.has(url.protocol) && /^[a-z][a-z0-9+.-]*:/i.test(href);
  } catch {
    return false;
  }
}

/**
 * Open a link in the user's real browser. Keeping navigation out of the
 * webview prevents a remote page from replacing the local viewer, and the
 * Tauri opener plugin avoids needing broad shell permissions.
 */
export async function openExternal(href: string): Promise<void> {
  if (!isExternalUrl(href)) {
    throw new Error("Only web and email links can be opened.");
  }

  if (isTauriRuntime()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(href);
    return;
  }

  const opened = window.open(href, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

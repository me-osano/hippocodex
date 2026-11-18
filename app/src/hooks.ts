import { useCallback, useEffect, useRef, useState } from "react";
import { THEME_LOOKS } from "./lib/theme";
import type { AppearanceState, DefaultMode, ThemeId, ThemeMode } from "./lib/theme";
import { persistTabsEnabled, readTabsEnabled } from "./lib/tabs";
import {
  applyDocumentAppearance,
  persistAppearance,
  readAppearance,
  resolveTheme,
} from "./lib/theme";
import {
  clearVaultPath,
  configureVault,
  fetchVaultInfo,
  persistVaultPath,
  readVaultPath,
  resetVault,
} from "./lib/vault";
import type { VaultInfo } from "./lib/vault";
import { isTauriRuntime } from "./platform/files";

export function usePersistentAppearance() {
  const [appearance, setAppearance] = useState<AppearanceState>(readAppearance);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const systemMode: ThemeMode = prefersDark ? "dark" : "light";
  const resolvedTheme = resolveTheme(appearance.theme, appearance.defaultMode, systemMode);

  useEffect(() => {
    applyDocumentAppearance(appearance, systemMode);
    persistAppearance(appearance);
  }, [appearance, systemMode]);

  const setTheme = useCallback((theme: ThemeId) => {
    setAppearance((current) => ({ ...current, theme, look: THEME_LOOKS[theme] }));
  }, []);

  const setDefaultMode = useCallback((defaultMode: DefaultMode) => {
    setAppearance((current) => ({ ...current, defaultMode }));
  }, []);

  const setGlass = useCallback((glass: boolean) => {
    setAppearance((current) => ({ ...current, glass }));
  }, []);

  const toggleGlass = useCallback(() => {
    setAppearance((current) => ({ ...current, glass: !current.glass }));
  }, []);

  const toggleReduceEffects = useCallback(() => {
    setAppearance((current) => ({ ...current, reduceEffects: !current.reduceEffects }));
  }, []);

  return {
    ...appearance,
    resolvedTheme,
    systemMode,
    setTheme,
    setDefaultMode,
    setGlass,
    toggleGlass,
    toggleReduceEffects,
  };
}

export function usePersistentTabs() {
  const [tabsEnabled, setTabsEnabled] = useState(readTabsEnabled);

  useEffect(() => {
    persistTabsEnabled(tabsEnabled);
  }, [tabsEnabled]);

  const toggleTabs = useCallback(() => {
    setTabsEnabled((enabled) => !enabled);
  }, []);

  return { tabsEnabled, toggleTabs };
}

/** Loads the persisted vault and decides whether first-run setup is needed. */
export function useVault() {
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      let info = await fetchVaultInfo().catch(() => null);

      // If the native config was lost but the webview still knows the path,
      // restore it instead of forcing the user through setup again.
      if (!info && isTauriRuntime()) {
        const stored = readVaultPath();
        if (stored) {
          try {
            info = await configureVault(stored);
          } catch {
            clearVaultPath();
          }
        }
      }

      if (info && !readVaultPath()) persistVaultPath(info.path);
      if (disposed) return;
      setVault(info);
      setWizardOpen(!info);
      setReady(true);
    })();

    return () => {
      disposed = true;
    };
  }, []);

  const completeVault = useCallback((info: VaultInfo) => {
    setVault(info);
    setWizardOpen(false);
  }, []);

  const openWizard = useCallback(() => setWizardOpen(true), []);
  const closeWizard = useCallback(() => setWizardOpen(false), []);

  const forgetVault = useCallback(async () => {
    await resetVault();
    setVault(null);
    setWizardOpen(true);
  }, []);

  return {
    vault,
    ready,
    wizardOpen,
    openWizard,
    closeWizard,
    completeVault,
    forgetVault,
  };
}

export function useToast(timeout = 4200) {
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback(
    (message: string, tone: "info" | "error" = "info") => {
      window.clearTimeout(timer.current);
      setToast({ message, tone });
      timer.current = window.setTimeout(() => setToast(null), timeout);
    },
    [timeout],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { toast, show, dismiss: () => setToast(null) };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    listener();
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

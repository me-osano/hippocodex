export type ThemeId = "default" | "paper" | "amoled" | "pure" | "canvas" | "studio";
export type ThemeMode = "light" | "dark";
export type DefaultMode = "auto" | ThemeMode;
export type ResolvedTheme = ThemeMode | "paper" | "amoled" | "pure" | "canvas" | "studio";

export interface ThemeLook {
  grainOpacity: number;
  grainScale: number;
  blur: number;
  accent: string;
  pureBlack: boolean;
}

export interface AppearanceState {
  theme: ThemeId;
  defaultMode: DefaultMode;
  glass: boolean;
  reduceEffects: boolean;
  look: ThemeLook;
}

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  /** Colours used by the picker swatch, not by the app itself. */
  swatch: {
    bg: string;
    surface: string;
    ink: string;
    accent: string;
    darkBg?: string;
    darkSurface?: string;
    darkAccent?: string;
  };
}

export const THEME_STORAGE_KEY = "hippocodex.theme";
export const THEME_MODE_STORAGE_KEY = "hippocodex.theme.defaultMode";
export const GLASS_STORAGE_KEY = "hippocodex.glass";
export const REDUCE_EFFECTS_STORAGE_KEY = "hippocodex.reduceEffects";
export const THEME_LOOK_STORAGE_KEY = "hippocodex.theme.look";

export const THEME_LOOKS: Record<ThemeId, ThemeLook> = {
  default: { grainOpacity: 0, grainScale: 1, blur: 18, accent: "#3f5d4e", pureBlack: false },
  paper: { grainOpacity: 0.08, grainScale: 0.8, blur: 0, accent: "#2b6e66", pureBlack: false },
  amoled: { grainOpacity: 0, grainScale: 1, blur: 18, accent: "#7fe0b0", pureBlack: true },
  pure: { grainOpacity: 0, grainScale: 1, blur: 18, accent: "#242424", pureBlack: false },
  canvas: { grainOpacity: 0, grainScale: 1, blur: 18, accent: "#94482a", pureBlack: false },
  studio: { grainOpacity: 0.18, grainScale: 1, blur: 16, accent: "#9bd6c0", pureBlack: false },
};

export const THEMES: readonly ThemeOption[] = [
  {
    id: "default",
    name: "Default",
    description: "Warm paper by day, ink by night.",
    swatch: {
      bg: "#f4f1e9",
      surface: "#fffdf8",
      ink: "#24211c",
      accent: "#3f5d4e",
      darkBg: "#161512",
      darkSurface: "#22211c",
      darkAccent: "#9dbfa8",
    },
  },
  {
    id: "paper",
    name: "Paper",
    description: "Soft paper for focused daylight reading.",
    swatch: {
      bg: "#f3f1ec",
      surface: "#fbfaf7",
      ink: "#23221f",
      accent: "#2b6e66",
    },
  },
  {
    id: "amoled",
    name: "AMOLED black",
    description: "True black with a mint highlight.",
    swatch: {
      bg: "#000000",
      surface: "#0d0d0d",
      ink: "#f2f2f2",
      accent: "#7fe0b0",
    },
  },
  {
    id: "pure",
    name: "Pure",
    description: "Prism's white light: clean and monochrome.",
    swatch: {
      bg: "#ffffff",
      surface: "#f3f3f3",
      ink: "#141414",
      accent: "#242424",
    },
  },
  {
    id: "canvas",
    name: "Canvas",
    description: "Paperwren's parchment and terracotta.",
    swatch: {
      bg: "#ede3d0",
      surface: "#f8f0e2",
      ink: "#3a2e22",
      accent: "#94482a",
    },
  },
  {
    id: "studio",
    name: "Studio",
    description: "Dark grain, soft glass, and a quiet accent.",
    swatch: {
      bg: "#121212",
      surface: "#2a2a2a",
      ink: "#f2f2f2",
      accent: "#9bd6c0",
    },
  },
];

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#f4f1e9",
  dark: "#161512",
  paper: "#f3f1ec",
  amoled: "#000000",
  pure: "#ffffff",
  canvas: "#ede3d0",
  studio: "#121212",
};

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === "default" || value === "paper" || value === "amoled" || value === "pure" || value === "canvas" || value === "studio";
}

function migrateThemeId(value: string | null, hasLook: boolean): ThemeId | null {
  if (value === "studio" && !hasLook) return "pure";
  if (value === "sand") return "canvas";
  return isThemeId(value) ? value : null;
}

function parseLook(value: string | null | undefined, fallback: ThemeLook): ThemeLook {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as Partial<ThemeLook>;
    if (
      typeof parsed.grainOpacity !== "number" ||
      typeof parsed.grainScale !== "number" ||
      typeof parsed.blur !== "number" ||
      typeof parsed.accent !== "string" ||
      typeof parsed.pureBlack !== "boolean"
    ) {
      return fallback;
    }
    return {
      grainOpacity: Math.max(0, Math.min(0.3, parsed.grainOpacity)),
      grainScale: Math.max(0.5, Math.min(1.2, parsed.grainScale)),
      blur: Math.max(0, Math.min(24, parsed.blur)),
      accent: parsed.accent,
      pureBlack: parsed.pureBlack,
    };
  } catch {
    return fallback;
  }
}

export function isDefaultMode(value: string | null | undefined): value is DefaultMode {
  return value === "auto" || value === "light" || value === "dark";
}

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function resolveTheme(
  theme: ThemeId,
  defaultMode: DefaultMode,
  systemMode: ThemeMode,
): ResolvedTheme {
  if (theme === "default") return defaultMode === "auto" ? systemMode : defaultMode;
  return theme;
}

export function parseAppearance(stored: {
  theme: string | null;
  defaultMode: string | null;
  glass: string | null;
  reduceEffects?: string | null;
  look?: string | null;
}): AppearanceState {
  // Before named themes, the stored value was the resolved light/dark pair.
  const legacyMode = isThemeMode(stored.theme) ? stored.theme : null;
  const theme = migrateThemeId(stored.theme, Boolean(stored.look)) ?? "default";
  const defaultMode = legacyMode ?? (isDefaultMode(stored.defaultMode) ? stored.defaultMode : "auto");

  return {
    theme,
    defaultMode,
    glass: stored.glass === "on" || stored.glass === "true",
    reduceEffects: stored.reduceEffects === "on" || stored.reduceEffects === "true",
    look: parseLook(stored.look, THEME_LOOKS[theme]),
  };
}

export function readAppearance(): AppearanceState {
  return parseAppearance({
    theme: window.localStorage.getItem(THEME_STORAGE_KEY),
    defaultMode: window.localStorage.getItem(THEME_MODE_STORAGE_KEY),
    glass: window.localStorage.getItem(GLASS_STORAGE_KEY),
    reduceEffects: window.localStorage.getItem(REDUCE_EFFECTS_STORAGE_KEY),
    look: window.localStorage.getItem(THEME_LOOK_STORAGE_KEY),
  });
}

export function persistAppearance(state: AppearanceState): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, state.theme);
  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, state.defaultMode);
  window.localStorage.setItem(GLASS_STORAGE_KEY, state.glass ? "on" : "off");
  window.localStorage.setItem(REDUCE_EFFECTS_STORAGE_KEY, state.reduceEffects ? "on" : "off");
  window.localStorage.setItem(THEME_LOOK_STORAGE_KEY, JSON.stringify(state.look));
}

export function systemThemeMode(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyDocumentAppearance(state: AppearanceState, systemMode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(state.theme, state.defaultMode, systemMode);
  const root = document.documentElement;

  root.dataset.theme = resolved;
  root.dataset.themeId = state.theme;
  if (state.glass) root.dataset.glass = "on";
  else delete root.dataset.glass;
  if (state.reduceEffects) root.dataset.reduceEffects = "on";
  else delete root.dataset.reduceEffects;
  root.style.setProperty("--grain-opacity", state.reduceEffects ? "0" : String(state.look.grainOpacity));
  root.style.setProperty("--grain-scale", String(state.look.grainScale));
  root.style.setProperty("--glass-blur", `${state.reduceEffects ? 0 : state.look.blur}px`);
  root.style.setProperty("--accent", state.look.accent);
  if (state.look.pureBlack) root.style.setProperty("--bg", "#000000");
  else root.style.removeProperty("--bg");

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[resolved];

  return resolved;
}

export function initializeAppearance(): AppearanceState {
  const state = readAppearance();
  applyDocumentAppearance(state, systemThemeMode());
  return state;
}

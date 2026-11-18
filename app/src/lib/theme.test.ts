import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GLASS_STORAGE_KEY,
  THEMES,
  THEME_COLORS,
  THEME_MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  REDUCE_EFFECTS_STORAGE_KEY,
  THEME_LOOK_STORAGE_KEY,
  isDefaultMode,
  isThemeId,
  isThemeMode,
  parseAppearance,
  persistAppearance,
  readAppearance,
  resolveTheme,
} from "./theme";

beforeEach(() => {
  window.localStorage.clear();
});

describe("theme ids", () => {
  it("recognises each named theme", () => {
    for (const option of THEMES) expect(isThemeId(option.id)).toBe(true);
    expect(THEMES.map((option) => option.id)).toEqual(["default", "paper", "amoled", "pure", "canvas", "studio"]);
  });

  it("rejects unknown or legacy values", () => {
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId("light")).toBe(false);
    expect(isThemeId("dark")).toBe(false);
    expect(isThemeId("AMOLED")).toBe(false);
    expect(isThemeId("")).toBe(false);
  });

  it("recognises modes and theme modes", () => {
    expect(isDefaultMode("auto")).toBe(true);
    expect(isDefaultMode("light")).toBe(true);
    expect(isDefaultMode("dark")).toBe(true);
    expect(isDefaultMode("system")).toBe(false);

    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("auto")).toBe(false);
  });
});

describe("resolveTheme", () => {
  it("follows the system for the default theme in auto mode", () => {
    expect(resolveTheme("default", "auto", "light")).toBe("light");
    expect(resolveTheme("default", "auto", "dark")).toBe("dark");
  });

  it("honours a fixed default mode over the system", () => {
    expect(resolveTheme("default", "light", "dark")).toBe("light");
    expect(resolveTheme("default", "dark", "light")).toBe("dark");
  });

  it("keeps named themes fixed regardless of system or mode", () => {
    for (const system of ["light", "dark"] as const) {
      for (const mode of ["auto", "light", "dark"] as const) {
        expect(resolveTheme("amoled", mode, system)).toBe("amoled");
        expect(resolveTheme("paper", mode, system)).toBe("paper");
        expect(resolveTheme("pure", mode, system)).toBe("pure");
        expect(resolveTheme("canvas", mode, system)).toBe("canvas");
        expect(resolveTheme("studio", mode, system)).toBe("studio");
      }
    }
  });

  it("has a theme-color for every resolved theme", () => {
    expect(Object.keys(THEME_COLORS).sort()).toEqual(["amoled", "canvas", "dark", "light", "paper", "pure", "studio"]);
  });
});

describe("parseAppearance", () => {
  it("defaults to auto, the default theme, and glass off", () => {
    expect(parseAppearance({ theme: null, defaultMode: null, glass: null })).toEqual({
      theme: "default",
      defaultMode: "auto",
      glass: false,
      reduceEffects: false,
      look: expect.any(Object),
    });
  });

  it("migrates legacy light and dark values into the default theme", () => {
    expect(parseAppearance({ theme: "light", defaultMode: null, glass: null })).toEqual({
      theme: "default",
      defaultMode: "light",
      glass: false,
      reduceEffects: false,
      look: expect.any(Object),
    });
    expect(parseAppearance({ theme: "dark", defaultMode: null, glass: null })).toEqual({
      theme: "default",
      defaultMode: "dark",
      glass: false,
      reduceEffects: false,
      look: expect.any(Object),
    });
  });

  it("reads a named theme and its stored mode", () => {
    expect(parseAppearance({ theme: "canvas", defaultMode: "dark", glass: "on" })).toEqual({
      theme: "canvas",
      defaultMode: "dark",
      glass: true,
      reduceEffects: false,
      look: expect.any(Object),
    });
  });

  it("ignores corrupt values", () => {
    expect(parseAppearance({ theme: "neon", defaultMode: "dusk", glass: "yes" })).toEqual({
      theme: "default",
      defaultMode: "auto",
      glass: false,
      reduceEffects: false,
      look: expect.any(Object),
    });
  });

  it("accepts the older boolean glass spelling", () => {
    expect(parseAppearance({ theme: null, defaultMode: null, glass: "true" }).glass).toBe(true);
    expect(parseAppearance({ theme: null, defaultMode: null, glass: "false" }).glass).toBe(false);
  });
});

describe("persistence", () => {
  it("round-trips the appearance through storage", () => {
    const state = {
      theme: "amoled" as const,
      defaultMode: "light" as const,
      glass: true,
      reduceEffects: true,
      look: {
        grainOpacity: 0.1,
        grainScale: 0.9,
        blur: 12,
        accent: "#7fe0b0",
        pureBlack: true,
      },
    };
    persistAppearance(state);

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("amoled");
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe("light");
    expect(window.localStorage.getItem(GLASS_STORAGE_KEY)).toBe("on");
    expect(window.localStorage.getItem(REDUCE_EFFECTS_STORAGE_KEY)).toBe("on");
    expect(window.localStorage.getItem(THEME_LOOK_STORAGE_KEY)).toBe(JSON.stringify(state.look));
    expect(readAppearance()).toEqual(state);
  });

  it("writes glass off explicitly", () => {
    persistAppearance({
      theme: "default",
      defaultMode: "auto",
      glass: false,
      reduceEffects: false,
      look: {
        grainOpacity: 0,
        grainScale: 1,
        blur: 18,
        accent: "#3f5d4e",
        pureBlack: false,
      },
    });

    expect(window.localStorage.getItem(GLASS_STORAGE_KEY)).toBe("off");
    expect(readAppearance().glass).toBe(false);
  });
});

describe("pre-paint theme script", () => {
  const script = readFileSync(resolve(process.cwd(), "public/theme-init.js"), "utf8");

  it("knows every storage key", () => {
    for (const key of [THEME_STORAGE_KEY, THEME_MODE_STORAGE_KEY, GLASS_STORAGE_KEY]) {
      expect(script).toContain(key);
    }
  });

  it("knows every theme id and theme colour", () => {
    for (const option of THEMES) expect(script).toContain(`"${option.id}"`);
    for (const colour of Object.values(THEME_COLORS)) expect(script).toContain(colour);
  });

  it("keeps the legacy light/dark migration", () => {
    expect(script).toContain('stored === "light" || stored === "dark"');
  });
});


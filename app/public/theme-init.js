/*
 * Applies the saved appearance before the first paint so a dark or named
 * theme never flashes the default light palette on launch.
 *
 * Keep the storage keys, theme ids and colours in sync with src/lib/theme.ts
 * (theme.test.ts checks that this file mentions all of them). This stays a
 * classic script: it has to run before the app bundle and is allowed by the
 * production CSP's `script-src 'self'`.
 */
(function () {
  try {
    var stored = window.localStorage.getItem("hippocodex.theme");
    var storedMode = window.localStorage.getItem("hippocodex.theme.defaultMode");
    var storedGlass = window.localStorage.getItem("hippocodex.glass");
    var storedReduceEffects = window.localStorage.getItem("hippocodex.reduceEffects");
    var storedLook = window.localStorage.getItem("hippocodex.theme.look");

    var ids = ["default", "paper", "amoled", "pure", "canvas", "studio"];
    var theme = stored === "studio" && !storedLook ? "pure" : stored === "sand" ? "canvas" : ids.indexOf(stored) >= 0 ? stored : "default";

    // Before named themes, the stored value was the resolved light/dark pair.
    var mode = stored === "light" || stored === "dark" ? stored : storedMode;
    if (mode !== "auto" && mode !== "light" && mode !== "dark") mode = "auto";

    var system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    var resolved = theme === "default" ? (mode === "auto" ? system : mode) : theme;
    var colors = {
      light: "#f4f1e9",
      dark: "#161512",
      paper: "#f3f1ec",
      amoled: "#000000",
      pure: "#ffffff",
      canvas: "#ede3d0",
      studio: "#121212",
    };

    var root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-theme-id", theme);
    if (storedGlass === "on" || storedGlass === "true") root.setAttribute("data-glass", "on");
    if (storedReduceEffects === "on" || storedReduceEffects === "true") {
      root.setAttribute("data-reduce-effects", "on");
    }
    try {
      var look = storedLook ? JSON.parse(storedLook) : null;
      if (look && typeof look === "object") {
        if (typeof look.grainOpacity === "number") root.style.setProperty("--grain-opacity", String(look.grainOpacity));
        if (typeof look.grainScale === "number") root.style.setProperty("--grain-scale", String(look.grainScale));
        if (typeof look.blur === "number") root.style.setProperty("--glass-blur", String(look.blur) + "px");
        if (typeof look.accent === "string") root.style.setProperty("--accent", look.accent);
        if (look.pureBlack === true) root.style.setProperty("--bg", "#000000");
      }
    } catch (error) {
      // The app validates the look again when it starts.
    }
    if (storedReduceEffects === "on" || storedReduceEffects === "true") {
      root.style.setProperty("--grain-opacity", "0");
      root.style.setProperty("--glass-blur", "0px");
    }

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", colors[resolved]);
  } catch (error) {
    // Storage can be unavailable in a hardened webview; the app falls back
    // to the default appearance when it starts.
  }
})();

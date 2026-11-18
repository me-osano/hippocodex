export const TABS_STORAGE_KEY = "hippocodex.tabs";

export function readTabsEnabled(): boolean {
  return window.localStorage.getItem(TABS_STORAGE_KEY) === "on";
}

export function persistTabsEnabled(enabled: boolean): void {
  window.localStorage.setItem(TABS_STORAGE_KEY, enabled ? "on" : "off");
}

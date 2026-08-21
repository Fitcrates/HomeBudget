export const LIGHT_THEME_COLOR = "#fcf8f2";
export const DARK_THEME_COLOR = "#0a0a0a";

const THEME_STORAGE_KEY = "homebudget_theme";

/**
 * Anything outside the React tree that has to follow the theme (portalled
 * toasts, for example) subscribes here — applyAppTheme is the single place
 * the theme actually changes.
 */
const listeners = new Set<() => void>();

export function subscribeToTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isDarkModeActive() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function getInitialDarkMode() {
  if (typeof window === "undefined") return false;
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark") return true;
  if (savedTheme === "light") return false;
  return document.documentElement.classList.contains("dark");
}

export function applyAppTheme(isDark: boolean) {
  const color = isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
  const root = document.documentElement;

  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
  root.style.backgroundColor = color;
  document.body.style.backgroundColor = color;

  document.getElementById("theme-color")?.setAttribute("content", color);
  // The app themes itself manually, so the UA must be told which scheme is in
  // force rather than being left to infer one from the OS preference.
  document
    .getElementById("color-scheme")
    ?.setAttribute("content", isDark ? "dark" : "light");
  document
    .getElementById("apple-status-bar-style")
    ?.setAttribute("content", isDark ? "black" : "default");

  window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");

  listeners.forEach((listener) => listener());
}

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const STORAGE_KEY = "clinifunnel-theme";

const VALID: readonly ThemeMode[] = ["light", "dark", "system"] as const;

function isValid(value: string): value is ThemeMode {
  return (VALID as readonly string[]).includes(value);
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw && isValid(raw)) return raw;
  return "system";
}

export function setStoredTheme(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  if (mode === "system") {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }
}

export function resolveTheme(
  mode: ThemeMode,
  prefersDark: () => boolean,
): ResolvedTheme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return prefersDark() ? "dark" : "light";
}

export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
}

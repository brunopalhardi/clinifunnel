"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  type ThemeMode,
  getStoredTheme,
  setStoredTheme,
  resolveTheme,
  applyTheme,
} from "@/lib/theme";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    setMode(getStoredTheme());
  }, []);

  function cycle() {
    const next: ThemeMode =
      mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    setMode(next);
    setStoredTheme(next);
    applyTheme(
      resolveTheme(next, () =>
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      ),
    );
  }

  const label =
    mode === "light" ? "Light" : mode === "dark" ? "Dark" : "Sistema";
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Modo: ${label}. Clique para alternar.`}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 transition-colors hover:bg-secondary"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

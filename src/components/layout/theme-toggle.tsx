"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";
  const Icon = isDark ? Moon : Sun;
  const label = isDark ? "Dark" : "Light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Modo: ${label}. Clique para alternar.`}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 transition-colors hover:bg-secondary"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

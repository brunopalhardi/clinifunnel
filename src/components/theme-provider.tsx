"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  type ResolvedTheme,
  applyTheme,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
} from "@/lib/theme";

const ThemeContext = createContext<{
  theme: ResolvedTheme;
  toggleTheme: () => void;
}>({ theme: "light", toggleTheme: () => {} });

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = getStoredTheme();
    const resolved = resolveTheme(stored, prefersDark);
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next: ResolvedTheme = current === "dark" ? "light" : "dark";
      setStoredTheme(next);
      applyTheme(next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

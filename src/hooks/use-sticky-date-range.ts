"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "clinifunnel:datePreset";

export type DatePresetId =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "thisMonth"
  | "lastMonth";

const VALID_PRESETS: ReadonlySet<DatePresetId> = new Set<DatePresetId>([
  "today",
  "yesterday",
  "7d",
  "30d",
  "90d",
  "thisMonth",
  "lastMonth",
]);

function isValidPreset(value: string): value is DatePresetId {
  return VALID_PRESETS.has(value as DatePresetId);
}

export function useStickyDateRange(fallback: DatePresetId = "30d"): {
  initialPreset: DatePresetId;
  save: (presetId: string | null) => void;
} {
  const [preset, setPreset] = useState<DatePresetId>(fallback);

  // Lê o preset salvo no localStorage apos hydration. Evita mismatch
  // SSR/client; o trade-off e um possivel re-fetch quando o stored
  // difere do fallback.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isValidPreset(stored)) {
        setPreset(stored);
      }
    } catch {
      // localStorage indisponivel (modo privado, etc) — segue com fallback.
    }
  }, []);

  // Custom ranges (presetId = null) nao sao persistidos: o sticky e por preset.
  const save = useCallback((presetId: string | null) => {
    if (!presetId || !isValidPreset(presetId)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, presetId);
    } catch {
      // ignore
    }
  }, []);

  return { initialPreset: preset, save };
}

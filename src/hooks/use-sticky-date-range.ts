"use client";

import { useCallback, useState } from "react";

export const STORAGE_KEY = "clinifunnel:datePreset";

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

export function readStoredPreset(fallback: DatePresetId): DatePresetId {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && isValidPreset(stored)) return stored;
  } catch {
    // localStorage indisponivel (modo privado, SSR, etc) — usa fallback.
  }
  return fallback;
}

export function writeStoredPreset(presetId: string | null): void {
  if (!presetId || !isValidPreset(presetId)) return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, presetId);
  } catch {
    // ignore
  }
}

// Le sincronicamente no mesmo tick do primeiro render via lazy useState.
// Evita o race em que o DateFilter (child) disparava onFilter -> save("30d")
// ANTES do hook (parent) conseguir ler o stored — sobrescrevendo o sticky
// com fallback na v0.44.0. Custom ranges (presetId = null) nao persistem.
export function useStickyDateRange(fallback: DatePresetId = "30d"): {
  initialPreset: DatePresetId;
  save: (presetId: string | null) => void;
} {
  const [initialPreset] = useState<DatePresetId>(() => readStoredPreset(fallback));
  const save = useCallback(writeStoredPreset, []);
  return { initialPreset, save };
}

"use client";

import { useCallback, useState } from "react";

export type ActionKind = "TRATADO" | "ADIADO_7" | "ADIADO_30" | "DISPENSADO";

export interface UseReminderActions {
  busy: Set<string>;
  openMenu: string | null;
  setOpenMenu: (key: string | null) => void;
  handleAction: (key: string, kind: ActionKind) => Promise<void>;
}

interface Options {
  onActioned: (key: string) => void;
  onError: () => void;
}

export function useReminderActions({ onActioned, onError }: Options): UseReminderActions {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const handleAction = useCallback(
    async (key: string, kind: ActionKind) => {
      setOpenMenu(null);
      setBusy((b) => {
        const c = new Set(b);
        c.add(key);
        return c;
      });
      try {
        const body: Record<string, unknown> = { reminderKey: key };
        if (kind === "TRATADO") body.action = "TRATADO";
        else if (kind === "DISPENSADO") body.action = "DISPENSADO";
        else {
          body.action = "ADIADO";
          const days = kind === "ADIADO_7" ? 7 : 30;
          body.snoozeUntil = new Date(Date.now() + days * 86400000).toISOString();
        }
        const res = await fetch("/api/reminders/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        onActioned(key);
      } catch {
        onError();
      } finally {
        setBusy((b) => {
          const c = new Set(b);
          c.delete(key);
          return c;
        });
      }
    },
    [onActioned, onError],
  );

  return { busy, openMenu, setOpenMenu, handleAction };
}

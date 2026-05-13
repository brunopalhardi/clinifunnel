"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/hooks/use-clinic";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const pageNames: Record<string, string> = {
  "/dashboard": "Captacao",
  "/dashboard/captacao": "Captacao",
  "/dashboard/operacao": "Operacao",
  "/dashboard/leads": "Leads",
  "/dashboard/campaigns": "Campanhas",
  "/dashboard/procedures": "Procedimentos",
  "/dashboard/patients": "Pacientes",
  "/dashboard/ltv": "LTV & ROAS",
  "/dashboard/logs": "Webhook Logs",
  "/dashboard/settings": "Configuracoes",
};

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "agora";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `ha ${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `ha ${hr}h`;
  const days = Math.floor(hr / 24);
  return `ha ${days}d`;
}

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { clinic, clinics, isSuperAdmin, selectClinic } = useClinic();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const pageName = pageNames[pathname] || "Dashboard";

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const last =
        [json?.data?.lastSyncAt, json?.data?.lastMatchAt]
          .filter((x): x is string => Boolean(x))
          .sort()
          .pop() ?? null;
      setLastSyncAt(last);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
    const refetch = setInterval(fetchSyncStatus, 60_000);
    const repaint = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      clearInterval(refetch);
      clearInterval(repaint);
    };
  }, [fetchSyncStatus]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "all" }),
      });
      setSyncMsg(res.ok ? "Sincronizado" : "Erro");
      if (res.ok) setTimeout(fetchSyncStatus, 5_000);
    } catch {
      setSyncMsg("Erro");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 3000);
  }

  const relative = formatRelative(lastSyncAt);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm">
        {isSuperAdmin && clinics.length >= 1 ? (
          <select
            value={clinic?.id ?? ""}
            onChange={(e) => selectClinic(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1 font-display text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-display font-semibold">{clinic?.name ?? "Dashboard"}</span>
        )}
        <span className="text-muted-foreground/40">/</span>
        <span className="text-muted-foreground">{pageName}</span>
      </div>
      <div className="flex items-center gap-3">
        {syncMsg && <span className="text-xs text-success">{syncMsg}</span>}
        {!syncMsg && relative && (
          <span
            className="text-xs text-muted-foreground"
            title={
              lastSyncAt
                ? `Ultima sincronizacao: ${new Date(lastSyncAt).toLocaleString("pt-BR")}`
                : undefined
            }
          >
            Atualizado {relative}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="h-8 gap-1.5 text-xs"
        >
          <svg
            className="h-3.5 w-3.5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {syncing ? "..." : "Sincronizar"}
        </Button>
        <ThemeToggle />
        {session?.user && (
          <>
            <span className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-[0_2px_8px_hsl(22_100%_55%_/_0.3)]"
                style={{
                  background: "linear-gradient(135deg, hsl(22 100% 55%), hsl(16 100% 55%))",
                }}
              >
                {session.user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <button
                onClick={async () => {
                  await fetch("/api/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Sair
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

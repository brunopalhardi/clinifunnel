"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/hooks/use-clinic";

const pageNames: Record<string, string> = {
  "/dashboard": "Visao Geral",
  "/dashboard/leads": "Leads",
  "/dashboard/campaigns": "Campanhas",
  "/dashboard/procedures": "Procedimentos",
  "/dashboard/logs": "Webhook Logs",
  "/dashboard/settings": "Configuracoes",
};

// Formata diff em "ha Xmin/Xh/Xd". Mostra "agora" pra <60s e "ha mais de Nd" pra grandes.
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
  // Tick force re-render do "ha Xmin" sem novo fetch — segundo a cada 30s eh suficiente.
  const [, setTick] = useState(0);

  const pageName = pageNames[pathname] || "Dashboard";

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      // O mais recente entre os dois jobs reflete melhor "ultima atualizacao do dashboard"
      // pra Bruno — ambos rodam juntos a cada 15min de qualquer jeito.
      const last = [json?.data?.lastSyncAt, json?.data?.lastMatchAt]
        .filter((x): x is string => Boolean(x))
        .sort()
        .pop() ?? null;
      setLastSyncAt(last);
    } catch {
      // silencioso: badge desaparece, nada mais
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
      if (res.ok) {
        // Espera o worker terminar (~5s suficiente pra updates curtos) antes de re-buscar status.
        setTimeout(fetchSyncStatus, 5_000);
      }
    } catch {
      setSyncMsg("Erro");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 3000);
  }

  const relative = formatRelative(lastSyncAt);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-sm px-6">
      <div className="flex items-center gap-2 text-sm">
        {isSuperAdmin && clinics.length >= 1 ? (
          <select
            value={clinic?.id ?? ""}
            onChange={(e) => selectClinic(e.target.value)}
            className="font-display font-semibold bg-transparent border border-border/50 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <span className="font-display font-semibold">
            {clinic?.name ?? "Dashboard"}
          </span>
        )}
        <span className="text-muted-foreground/40">/</span>
        <span className="text-muted-foreground">{pageName}</span>
      </div>
      <div className="flex items-center gap-3">
        {syncMsg && (
          <span className="text-xs text-success">{syncMsg}</span>
        )}
        {!syncMsg && relative && (
          <span
            className="text-xs text-muted-foreground"
            title={lastSyncAt ? `Ultima sincronizacao: ${new Date(lastSyncAt).toLocaleString("pt-BR")}` : undefined}
          >
            Atualizado {relative}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="h-8 gap-1.5 border-border/50 text-xs"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {syncing ? "..." : "Sincronizar"}
        </Button>
        {session?.user && (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/20 text-[11px] font-semibold text-gold">
              {session.user.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <button
              onClick={async () => {
                await fetch("/api/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const pageNames: Record<string, string> = {
  "/dashboard": "Visao Geral",
  "/dashboard/leads": "Leads",
  "/dashboard/campaigns": "Campanhas",
  "/dashboard/procedures": "Procedimentos",
  "/dashboard/logs": "Webhook Logs",
  "/dashboard/settings": "Configuracoes",
};

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const pageName = pageNames[pathname] || "Dashboard";

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
    } catch {
      setSyncMsg("Erro");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 3000);
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-sm px-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-display font-semibold">
          {session?.user?.clinicName ?? "Dashboard"}
        </span>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-muted-foreground">{pageName}</span>
      </div>
      <div className="flex items-center gap-3">
        {syncMsg && (
          <span className="text-xs text-success">{syncMsg}</span>
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
              onClick={() => signOut({ callbackUrl: "/login" })}
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

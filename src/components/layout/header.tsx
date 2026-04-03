"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Header() {
  const { data: session } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "all" }),
      });
      if (res.ok) {
        setSyncMsg("Sincronizacao iniciada");
      } else {
        setSyncMsg("Erro ao sincronizar");
      }
    } catch {
      setSyncMsg("Erro ao sincronizar");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 3000);
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div>
        <h2 className="text-lg font-semibold">
          {session?.user?.clinicName ?? "Dashboard"}
        </h2>
      </div>
      <div className="flex items-center gap-4">
        {syncMsg && (
          <span className="text-xs text-muted-foreground">{syncMsg}</span>
        )}
        {session?.user && (
          <span className="text-sm text-muted-foreground">
            {session.user.name}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sair
        </Button>
      </div>
    </header>
  );
}

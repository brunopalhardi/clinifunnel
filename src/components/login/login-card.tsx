"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginCard() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Email ou senha invalidos");
        setLoading(false);
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError("Erro ao conectar. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-xl p-8 sm:rounded-[1.375rem] sm:p-9">
      <div className="mb-6 flex items-center gap-2.5">
        <div
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-[10px] font-display text-[17px] font-extrabold text-white shadow-button"
          style={{
            background: "linear-gradient(135deg, hsl(22 100% 55%), hsl(16 100% 55%))",
          }}
        >
          C
        </div>
        <span className="font-display text-[19px] font-extrabold tracking-tight text-foreground">
          Clini<span className="text-primary">Funnel</span>
        </span>
      </div>

      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
        Painel de gestão
      </div>
      <h1 className="mb-1.5 font-display text-2xl font-bold tracking-tight text-foreground">
        Acessar sua clínica
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Entre com email e senha pra continuar
      </p>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium">
            Senha
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end pt-1">
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Esqueci minha senha →
          </Link>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full text-sm font-semibold shadow-button"
        >
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}

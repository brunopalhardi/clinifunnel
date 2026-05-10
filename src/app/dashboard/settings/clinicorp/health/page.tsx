"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/hooks/use-clinic";

interface HealthCheck {
  id: string;
  label: string;
  status: "ok" | "warning" | "error" | "info";
  message?: string;
}

interface HealthCounts {
  kommoWebhooks24h: number;
  clinicorpWebhooks24h: number;
  errorWebhooks24h: number;
  leadsCreated24h: number;
  proceduresCreated24h: number;
}

interface KommoFieldsChecks {
  appointmentDate: HealthCheck;
  professional: HealthCheck;
}

const statusIcon: Record<HealthCheck["status"], string> = {
  ok: "✓",
  warning: "⚠",
  error: "✗",
  info: "•",
};

const statusColor: Record<HealthCheck["status"], string> = {
  ok: "text-green-600 bg-green-500/10 border-green-500/30",
  warning: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  error: "text-red-600 bg-red-500/10 border-red-500/30",
  info: "text-muted-foreground bg-muted border-border",
};

function CheckRow({ check }: { check: HealthCheck }) {
  return (
    <div
      className={`flex items-start gap-3 rounded border px-3 py-2 ${statusColor[check.status]}`}
    >
      <span className="font-mono text-base leading-tight">{statusIcon[check.status]}</span>
      <div className="flex-1">
        <p className="text-sm font-medium">{check.label}</p>
        {check.message && (
          <p className="mt-0.5 text-xs opacity-80">{check.message}</p>
        )}
      </div>
    </div>
  );
}

export default function HealthPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [checks, setChecks] = useState<HealthCheck[] | null>(null);
  const [counts, setCounts] = useState<HealthCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Kommo fields (carrega em paralelo com fallback)
  const [kommoChecks, setKommoChecks] = useState<KommoFieldsChecks | null>(null);
  const [kommoError, setKommoError] = useState<string | null>(null);
  const [kommoLoading, setKommoLoading] = useState(true);

  useEffect(() => {
    if (!clinic) return;

    setLoading(true);
    setError(null);
    fetch(`/api/clinics/${clinic.id}/health`)
      .then((res) => res.json().then((j) => ({ ok: res.ok, json: j })))
      .then(({ ok, json }) => {
        if (!ok) {
          setError(json.error ?? "Erro ao carregar health");
          return;
        }
        setChecks(json.data?.checks ?? []);
        setCounts(json.data?.counts ?? null);
      })
      .catch(() => setError("Erro de rede"))
      .finally(() => setLoading(false));

    setKommoLoading(true);
    setKommoError(null);
    fetch(`/api/clinics/${clinic.id}/health/kommo-fields`)
      .then((res) => res.json().then((j) => ({ ok: res.ok, json: j })))
      .then(({ ok, json }) => {
        if (!ok) {
          setKommoError(json.error ?? "Erro ao consultar Kommo");
          return;
        }
        setKommoChecks(json.data?.checks ?? null);
      })
      .catch(() => setKommoError("Erro de rede ao consultar Kommo"))
      .finally(() => setKommoLoading(false));
  }, [clinic]);

  if (clinicLoading || loading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!clinic) {
    return (
      <p className="text-muted-foreground">
        Nenhuma clinica encontrada.
      </p>
    );
  }

  // Resumo: contagem por status (excluindo info)
  const errorCount = checks?.filter((c) => c.status === "error").length ?? 0;
  const warningCount = checks?.filter((c) => c.status === "warning").length ?? 0;
  const kommoErrorCount = kommoChecks
    ? [kommoChecks.appointmentDate, kommoChecks.professional].filter((c) => c.status === "error").length
    : 0;
  const totalErrors = errorCount + kommoErrorCount;

  let summaryStatus: "ok" | "warning" | "error" = "ok";
  let summaryText = "Tudo OK — automacao deve funcionar 100%.";
  if (totalErrors > 0) {
    summaryStatus = "error";
    summaryText = `${totalErrors} item(ns) com erro. Automacao bloqueada ate corrigir.`;
  } else if (warningCount > 0) {
    summaryStatus = "warning";
    summaryText = `${warningCount} aviso(s). Automacao funciona mas com limitacao.`;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/settings"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Configuracoes
        </Link>
        <h1 className="text-2xl font-bold">Health da automacao Kommo→Clinicorp</h1>
        <p className="text-sm text-muted-foreground">
          Checklist em 1 olhada do que esta OK ou faltando pra automacao funcionar 100%.
        </p>
      </div>

      <div
        className={`rounded border-2 px-4 py-3 ${
          summaryStatus === "error"
            ? "border-red-500/40 bg-red-500/5"
            : summaryStatus === "warning"
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-green-500/40 bg-green-500/5"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{summaryText}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configuracao e atividade ({clinic.name})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {checks?.map((check) => <CheckRow key={check.id} check={check} />) ?? null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validacao dos campos no Kommo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {kommoLoading && (
            <p className="text-xs text-muted-foreground">Consultando Kommo...</p>
          )}
          {kommoError && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
              <p className="font-medium">Nao foi possivel validar campos do Kommo</p>
              <p className="mt-0.5 opacity-80">{kommoError}</p>
              <p className="mt-1 opacity-70">
                Pode ser token expirado ou Kommo offline. As demais checagens acima
                continuam validas.
              </p>
            </div>
          )}
          {kommoChecks && (
            <>
              <CheckRow check={kommoChecks.appointmentDate} />
              <CheckRow check={kommoChecks.professional} />
            </>
          )}
        </CardContent>
      </Card>

      {counts && (
        <Card>
          <CardContent className="pt-4 text-xs text-muted-foreground">
            <p>
              Atividade nas ultimas 24h: {counts.kommoWebhooks24h} webhooks Kommo,{" "}
              {counts.clinicorpWebhooks24h} webhooks Clinicorp,{" "}
              {counts.leadsCreated24h} leads novos, {counts.proceduresCreated24h} procedures novos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

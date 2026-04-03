"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClinic } from "@/hooks/use-clinic";

interface FunnelData {
  totalLeads: number;
  agendamentos: number;
  procedimentos: number;
  totalRevenue: number;
  taxaLeadConsulta: number;
  taxaConsultaFechamento: number;
  taxaLeadFechamento: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export default function FunilPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    fetch(`/api/metrics/detailed?clinicId=${clinic.id}&days=${days}`)
      .then((res) => res.json())
      .then((json) => setData(json.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (clinicLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!clinic) return <p className="text-muted-foreground">Nenhuma clinica encontrada.</p>;

  const m = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funil detalhado</h1>
          <p className="text-sm text-muted-foreground">Lead &rarr; Consulta &rarr; Procedimento &rarr; Receita</p>
        </div>
        <div className="flex rounded-lg border">
          {[{ d: 7, l: "7 dias" }, { d: 30, l: "30 dias" }, { d: 90, l: "Trimestre" }].map((p) => (
            <button
              key={p.d}
              onClick={() => setDays(p.d)}
              className={`px-4 py-2 text-sm transition-colors ${
                days === p.d ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              } ${p.d === 7 ? "rounded-l-lg" : p.d === 90 ? "rounded-r-lg" : ""}`}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {loading || !m ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <>
          {/* Taxa cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Taxa lead &rarr; consulta</p>
                <p className="text-4xl font-bold text-emerald-700">{m.taxaLeadConsulta.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Taxa consulta &rarr; fechamento</p>
                <p className="text-4xl font-bold text-emerald-700">{m.taxaConsultaFechamento.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Taxa lead &rarr; fechamento</p>
                <p className="text-4xl font-bold text-emerald-700">{m.taxaLeadFechamento.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Funil completo */}
          <Card>
            <CardHeader>
              <CardTitle>Funil de conversao completo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: "Leads captados", value: m.totalLeads, color: "bg-emerald-800" },
                { label: "Consultas agendadas", value: m.agendamentos, color: "bg-emerald-600" },
                { label: "Fecharam procedimento", value: m.procedimentos, color: "bg-emerald-400" },
              ].map((stage, i, arr) => {
                const maxVal = arr[0].value || 1;
                const width = (stage.value / maxVal) * 100;
                const pctOfTotal = i > 0 ? ((stage.value / maxVal) * 100).toFixed(1) : null;
                const drop = i > 0 ? (100 - (stage.value / (arr[i - 1].value || 1)) * 100) : null;
                return (
                  <div key={stage.label} className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold">{stage.label}</span>
                      <span>
                        <span className="text-lg font-bold">{stage.value}</span>
                        {pctOfTotal !== null && (
                          <span className="ml-2 text-sm text-muted-foreground">({pctOfTotal}%)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-10 w-full rounded-lg bg-muted">
                      <div
                        className={`h-full rounded-lg ${stage.color} transition-all`}
                        style={{ width: `${Math.max(width, 2)}%` }}
                      />
                    </div>
                    {drop !== null && drop > 0 && (
                      <p className="text-xs text-red-500">&darr; {drop.toFixed(1)}% de queda</p>
                    )}
                  </div>
                );
              })}

              {/* Receita total no final do funil */}
              <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-center">
                <p className="text-sm text-muted-foreground">Receita gerada no periodo</p>
                <p className="text-3xl font-bold text-emerald-700">{fmt(m.totalRevenue)}</p>
                {m.procedimentos > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Ticket medio: {fmt(m.totalRevenue / m.procedimentos)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";

interface LTVData {
  totalRevenue: number;
  totalAdSpend: number;
  roas: number | null;
  avgLTV: number;
  avgLeadToRevenueDays: number | null;
  totalPatients: number;
  canalPerformance: {
    canal: string;
    leads: number;
    patients: number;
    revenue: number;
    procedures: number;
    avgLTV: number;
    conversionRate: number;
  }[];
  topPatients: {
    patientId: string;
    name: string;
    canal: string;
    totalRevenue: number;
    procedureCount: number;
    leadToRevenueDays: number | null;
  }[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const empty: LTVData = {
  totalRevenue: 0, totalAdSpend: 0, roas: null, avgLTV: 0,
  avgLeadToRevenueDays: null, totalPatients: 0, canalPerformance: [], topPatients: [],
};

export default function LTVPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [data, setData] = useState<LTVData>(empty);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [patientType, setPatientType] = useState<"all" | "new" | "returning">("all");

  const fetchData = useCallback(() => {
    if (!clinic) return;
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    if (patientType !== "all") params.set("patientType", patientType);
    fetch(`/api/dashboard/ltv?${params}`)
      .then((res) => res.json())
      .then((json) => setData(json.data ?? empty))
      .catch(() => {});
  }, [clinic, dateRange, patientType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  const d = data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">LTV & ROAS</h1>
          <p className="text-sm text-muted-foreground">{clinic?.name} — Metricas de receita e retorno</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["all", "new", "returning"] as const).map((type) => {
              const labels = { all: "Todos", new: "Novos", returning: "Existentes" };
              const isActive = patientType === type;
              return (
                <button
                  key={type}
                  onClick={() => setPatientType(type)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-gold/15 text-gold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                  }`}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>
          <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="font-display text-2xl font-bold text-gold mt-1">{fmt(d.totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-sm text-muted-foreground">Investimento Ads</p>
          <p className="font-display text-2xl font-bold mt-1">{fmt(d.totalAdSpend)}</p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-sm text-muted-foreground">ROAS Geral</p>
          <p className="font-display text-2xl font-bold mt-1">
            {d.roas !== null ? `${d.roas.toFixed(1)}x` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-sm text-muted-foreground">LTV Medio</p>
          <p className="font-display text-2xl font-bold mt-1">{fmt(d.avgLTV)}</p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-sm text-muted-foreground">Lead → Receita</p>
          <p className="font-display text-2xl font-bold mt-1">
            {d.avgLeadToRevenueDays !== null ? `${d.avgLeadToRevenueDays} dias` : "—"}
          </p>
        </div>
      </div>

      {/* Performance por Canal */}
      <div className="rounded-xl bg-card p-6 glass-border">
        <h2 className="font-display text-lg font-semibold mb-4">Performance por Canal de Aquisicao</h2>
        {d.canalPerformance.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dado disponivel. Leads precisam ter o campo &quot;Canal de Prospeccao&quot; preenchido na Kommo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3 pr-4 font-medium text-muted-foreground">Canal</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Leads</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Pacientes</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Conversao</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Procedimentos</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Receita</th>
                  <th className="py-3 font-medium text-muted-foreground text-right">LTV Medio</th>
                </tr>
              </thead>
              <tbody>
                {d.canalPerformance.map((c) => (
                  <tr key={c.canal} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium">{c.canal}</td>
                    <td className="py-3 pr-4 text-right">{c.leads}</td>
                    <td className="py-3 pr-4 text-right">{c.patients}</td>
                    <td className="py-3 pr-4 text-right">{c.conversionRate.toFixed(1)}%</td>
                    <td className="py-3 pr-4 text-right">{c.procedures}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{fmt(c.revenue)}</td>
                    <td className="py-3 text-right">{fmt(c.avgLTV)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Pacientes */}
      <div className="rounded-xl bg-card p-6 glass-border">
        <h2 className="font-display text-lg font-semibold mb-4">Top 10 Pacientes por Receita</h2>
        {d.topPatients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum paciente com receita registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3 pr-4 font-medium text-muted-foreground">Paciente</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground">Canal</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Procedimentos</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Receita Total</th>
                  <th className="py-3 font-medium text-muted-foreground text-right">Lead → Receita</th>
                </tr>
              </thead>
              <tbody>
                {d.topPatients.map((p) => (
                  <tr key={p.patientId} className="border-b border-border/50">
                    <td className="py-3 pr-4">
                      <a href={`/dashboard/patients/${p.patientId}`} className="font-medium hover:text-gold transition-colors">
                        {p.name}
                      </a>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.canal}</td>
                    <td className="py-3 pr-4 text-right">{p.procedureCount}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{fmt(p.totalRevenue)}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {p.leadToRevenueDays !== null ? `${p.leadToRevenueDays}d` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

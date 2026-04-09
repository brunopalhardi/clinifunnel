"use client";

import { useCallback, useEffect, useState } from "react";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";
import { FunnelMetrics } from "@/types";

const emptyMetrics: FunnelMetrics = {
  totalLeads: 0,
  campaignLeads: 0,
  organicLeads: 0,
  agendamentos: 0,
  procedimentos: 0,
  totalRevenue: 0,
  conversionRate: 0,
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function DashboardPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [metrics, setMetrics] = useState<FunnelMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const fetchMetrics = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/metrics?${params}`)
      .then((res) => res.json())
      .then((json) => setMetrics(json.data ?? emptyMetrics))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, dateRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (clinicLoading) {
    return <p className="text-muted-foreground p-8">Carregando...</p>;
  }

  const m = metrics;
  const agendRate = m.totalLeads > 0 ? ((m.agendamentos / m.totalLeads) * 100) : 0;
  const procRate = m.agendamentos > 0 ? ((m.procedimentos / m.agendamentos) * 100) : 0;
  const campPercent = m.totalLeads > 0 ? ((m.campaignLeads / m.totalLeads) * 100) : 0;
  const ticketMedio = m.procedimentos > 0 ? m.totalRevenue / m.procedimentos : 0;
  const cpl = m.campaignLeads > 0 ? 0 : 0; // TODO: from ads data

  return (
    <div className="space-y-6">
      {/* Title + Date */}
      <div>
        <h1 className="font-display text-2xl font-bold">Visao Geral</h1>
        <p className="text-sm text-muted-foreground">Metricas de desempenho e funil de conversao em tempo real.</p>
      </div>

      <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total de Leads"
          value={String(m.totalLeads)}
          sub={`${m.campaignLeads} campanha | ${m.organicLeads} organico`}
          trend={loading ? undefined : "+12%"}
          icon={<LeadsIcon />}
        />
        <KpiCard
          label="Agendamentos"
          value={String(m.agendamentos)}
          sub={`${agendRate.toFixed(1)}% dos leads`}
          subColor="text-success"
          icon={<CalendarIcon />}
        />
        <KpiCard
          label="Procedimentos"
          value={String(m.procedimentos)}
          sub={`${procRate.toFixed(1)}% agendamentos`}
          icon={<CheckIcon />}
        />
        <KpiCard
          label="Receita Total"
          value={fmt(m.totalRevenue)}
          valueClass="text-gold"
          sub={ticketMedio > 0 ? `${fmt(ticketMedio)} / procedimento` : "—"}
          icon={<RevenueIcon />}
        />
      </div>

      {/* Funnel + Summary */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Funnel */}
        <div className="lg:col-span-3 rounded-xl bg-card p-6 glass-border">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Funil de Vendas</h2>
            <span className="text-xs text-muted-foreground">VS PERIODO ANTERIOR</span>
          </div>
          <div className="space-y-5">
            <FunnelBar label="Leads Brutos" sub="Visitantes convertidos em contatos" value={m.totalLeads} max={m.totalLeads} pct={100} />
            <FunnelBar label="Qualificados / Agendados" sub="Agendamentos confirmados em agenda" value={m.agendamentos} max={m.totalLeads} pct={agendRate} />
            <FunnelBar label="Convertidos / Procedimentos" sub="Tratamentos iniciados e faturados" value={m.procedimentos} max={m.totalLeads} pct={m.totalLeads > 0 ? (m.procedimentos / m.totalLeads) * 100 : 0} />
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2 rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-4">Resumo Executivo</h2>
          {m.totalLeads === 0 ? (
            <p className="text-sm text-muted-foreground">Configure integracoes para ver dados.</p>
          ) : (
            <div className="space-y-4">
              <InsightItem
                color="text-success"
                title="Growth Opportunity"
                text={`A taxa de agendamento esta ${agendRate.toFixed(0)}% ${agendRate > 50 ? "acima" : "abaixo"} da media do setor.`}
              />
              <InsightItem
                color="text-gold"
                title="Origem dos Leads"
                text={`${campPercent.toFixed(0)}% dos leads vem de campanhas pagas.`}
              />
              {ticketMedio > 0 && (
                <InsightItem
                  color="text-gold"
                  title="Ticket Medio"
                  text={`${fmt(ticketMedio)} por procedimento realizado.`}
                />
              )}
              {m.agendamentos > m.procedimentos && (
                <InsightItem
                  color="text-destructive"
                  title="Gargalo de Conversao"
                  text={`${m.agendamentos - m.procedimentos} agendamentos nao se converteram. Sugerido reforco no pos-consulta.`}
                />
              )}
            </div>
          )}
          <button className="mt-6 w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-gold-foreground transition-all hover:opacity-90">
            Exportar Relatorio Completo (PDF)
          </button>
        </div>
      </div>

      {/* Bottom metrics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Custo por Lead (CPL)</p>
          <p className="font-display text-2xl font-bold">{cpl > 0 ? fmt(cpl) : "—"}</p>
          {cpl > 0 && <p className="text-xs text-success mt-1">vs periodo anterior</p>}
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Satisfacao (NPS)</p>
          <p className="font-display text-2xl font-bold">9.8 <span className="text-sm text-gold">★★★★★</span></p>
          <p className="text-xs text-muted-foreground mt-1">Baseado em avaliacoes pos-procedimento</p>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function KpiCard({ label, value, valueClass, sub, subColor, trend, icon }: {
  label: string; value: string; valueClass?: string; sub: string;
  subColor?: string; trend?: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card p-5 glass-border card-hover">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold">
          {icon}
        </div>
      </div>
      <p className={`font-display text-2xl font-bold ${valueClass || ""}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {trend && <span className="text-xs text-success font-medium">{trend}</span>}
        <p className={`text-xs ${subColor || "text-muted-foreground"}`}>{sub}</p>
      </div>
    </div>
  );
}

function FunnelBar({ label, sub, value, max, pct }: {
  label: string; sub: string; value: number; max: number; pct: number;
}) {
  const width = max > 0 ? Math.max((value / max) * 100, 4) : 4;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-sm font-medium">{label}</span>
          <span className="ml-2 text-xs text-muted-foreground">{sub}</span>
        </div>
        <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display text-lg font-bold text-gold">{value}</span>
        <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold transition-all duration-700"
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function InsightItem({ color, title, text }: { color: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className={`mt-1.5 h-2 w-2 rounded-full ${color.replace("text-", "bg-")} shrink-0`} />
      <div>
        <p className={`text-sm font-semibold ${color}`}>{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function LeadsIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function CalendarIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
}
function CheckIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}
function RevenueIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}

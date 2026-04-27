"use client";

import { useCallback, useEffect, useState } from "react";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";

interface DashboardData {
  totalLeads: number;
  campaignLeads: number;
  organicLeads: number;
  agendamentos: number;
  compareceram: number;
  procedimentos: number;
  totalRevenue: number;
  procedimentosClinica: number;
  receitaClinica: number;
  totalSpend: number;
  cpl: number | null;
  conversionRate: number;
  revenueChart: { day: string; iso?: string; value: number }[];
  revenueGranularity?: "day" | "week" | "month";
  topProcedures: { name: string; count: number; revenue: number; ticketMedio: number }[];
  channelPerformance: { channel: string; spend: number; impressions: number; clicks: number }[];
  canalBreakdown: { canal: string; count: number }[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : fmt(v);

const empty: DashboardData = {
  totalLeads: 0, campaignLeads: 0, organicLeads: 0, agendamentos: 0,
  compareceram: 0, procedimentos: 0, totalRevenue: 0, procedimentosClinica: 0, receitaClinica: 0, totalSpend: 0, cpl: null,
  conversionRate: 0, revenueChart: [], topProcedures: [], channelPerformance: [],
  canalBreakdown: [],
};

export default function DashboardPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [data, setData] = useState<DashboardData>(empty);
  const [, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [patientType, setPatientType] = useState<"all" | "new" | "returning">("all");

  const fetchData = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    if (patientType !== "all") params.set("patientType", patientType);
    fetch(`/api/dashboard?${params}`)
      .then((res) => res.json())
      .then((json) => setData(json.data ?? empty))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, dateRange, patientType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  const d = data;
  const agendRate = d.totalLeads > 0 ? (d.agendamentos / d.totalLeads) * 100 : 0;
  const compareRate = d.totalLeads > 0 ? (d.compareceram / d.totalLeads) * 100 : 0;
  const procRate = d.totalLeads > 0 ? (d.procedimentos / d.totalLeads) * 100 : 0;
  const maxRevenue = Math.max(...d.revenueChart.map(r => r.value), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Visao Geral</h1>
          <p className="text-sm text-muted-foreground">{clinic?.name} — Dashboard completo</p>
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

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Leads captados"
          value={d.totalLeads}
          breakdown={`Meta: ${d.campaignLeads}  Organico: ${d.organicLeads}`}
          icon={<UsersIcon />}
        />
        <KpiCard
          label="Consultas realizadas"
          value={d.agendamentos}
          icon={<CalendarIcon />}
        />
        <KpiCard
          label="Procedimentos fechados"
          value={d.procedimentos}
          breakdown={d.procedimentosClinica > d.procedimentos ? `Clinica: ${d.procedimentosClinica} (total)` : undefined}
          icon={<CheckIcon />}
        />
        <KpiCard
          label="Receita do funil"
          value={d.totalRevenue}
          isCurrency
          breakdown={d.receitaClinica > d.totalRevenue ? `Clinica: ${fmtK(d.receitaClinica)} (total)` : undefined}
          icon={<DollarIcon />}
          highlight
        />
      </div>

      {/* Funnel + Revenue Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-5">Funil de conversao</h2>
          <div className="space-y-5">
            <FunnelRow label="Leads captados" value={d.totalLeads} max={d.totalLeads} pct={100} />
            <FunnelRow
              label="Consultas agendadas"
              value={d.agendamentos}
              max={d.totalLeads}
              pct={agendRate}
              drop={d.totalLeads > 0 ? 100 - agendRate : 0}
            />
            <FunnelRow
              label="Compareceram"
              value={d.compareceram}
              max={d.totalLeads}
              pct={compareRate}
              drop={d.agendamentos > 0 ? ((d.agendamentos - d.compareceram) / d.agendamentos) * 100 : 0}
            />
            <FunnelRow
              label="Fecharam procedimento"
              value={d.procedimentos}
              max={d.totalLeads}
              pct={procRate}
              drop={d.compareceram > 0 ? ((d.compareceram - d.procedimentos) / d.compareceram) * 100 : 0}
            />
          </div>
        </div>

        {/* Revenue Timeline */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold">Receita por periodo</h2>
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {d.revenueGranularity === "day" && "Por dia"}
              {d.revenueGranularity === "week" && "Por semana"}
              {d.revenueGranularity === "month" && "Por mes"}
            </span>
          </div>
          {d.revenueChart.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem receita no periodo.</p>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex items-end gap-1 h-48 min-w-full" style={{ minWidth: `${Math.max(d.revenueChart.length * 32, 100)}px` }}>
                {d.revenueChart.map((r, idx) => (
                  <div key={`${r.day}-${idx}`} className="flex flex-1 min-w-[28px] flex-col items-center gap-1 group relative">
                    <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 whitespace-nowrap">
                      {fmtK(r.value)}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-success/80 hover:bg-success transition-all duration-500"
                      style={{
                        height: `${maxRevenue > 0 ? (r.value / maxRevenue) * 150 : 4}px`,
                        minHeight: r.value > 0 ? "4px" : "2px",
                      }}
                      title={`${r.day}: ${fmt(r.value)}`}
                    />
                    <span className="text-[9px] text-muted-foreground rotate-[-45deg] origin-top-left whitespace-nowrap mt-1 ml-2">
                      {r.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Performance by Channel + Top Procedures */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Channel Performance */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Performance por canal</h2>
            <span className="text-xs text-muted-foreground">Top 3</span>
          </div>
          <div className="space-y-4">
            {d.channelPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">Conecte Meta/Google Ads para ver dados.</p>
            ) : (
              d.channelPerformance.slice(0, 3).map((ch) => (
                <div key={ch.channel} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{ch.channel}</p>
                    <p className="text-xs text-muted-foreground">
                      {ch.clicks} cliques · {ch.impressions > 0 ? `${((ch.clicks / ch.impressions) * 100).toFixed(1)}% CTR` : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{ch.spend > 0 ? fmtK(ch.spend) : "—"}</p>
                    {ch.spend > 0 && d.totalRevenue > 0 && (
                      <p className="text-xs text-success">{((d.totalRevenue / ch.spend)).toFixed(1)}x ROI</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Procedures */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Top procedimentos</h2>
            <span className="text-xs text-muted-foreground">Top 3</span>
          </div>
          <div className="space-y-4">
            {d.topProcedures.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum procedimento no periodo.</p>
            ) : (
              d.topProcedures.map((p) => (
                <div key={p.name} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.count} fechados · TM {fmtK(p.ticketMedio)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmtK(p.revenue)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Canal de Prospeccao Breakdown */}
      {d.canalBreakdown.length > 0 && (
        <div className="rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-4">Leads por canal de prospeccao</h2>
          <div className="space-y-3">
            {d.canalBreakdown.map((c) => {
              const pct = d.totalLeads > 0 ? (c.count / d.totalLeads) * 100 : 0;
              return (
                <div key={c.canal} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{c.canal}</span>
                      <span>{c.count} <span className="text-muted-foreground text-xs">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold transition-all"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insight Card */}
      <div className="rounded-xl border-l-4 border-gold bg-card p-5 glass-border">
        <div className="flex gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold shrink-0">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gold">Insight automatico</p>
            <p className="text-sm text-muted-foreground mt-1">
              {d.totalLeads > 0
                ? `Nos ultimos dias, a taxa de conversao de leads para procedimentos esta em ${procRate.toFixed(1)}%. ${procRate > 20 ? "Performance acima da media do setor." : "Recomendacao: reforcar follow-up pos-consulta para aumentar conversao."}`
                : "Configure as integracoes para receber insights automaticos."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Components ---

function KpiCard({ label, value, isCurrency, breakdown, icon, highlight }: {
  label: string; value: number; isCurrency?: boolean;
  breakdown?: string; icon: React.ReactNode; highlight?: boolean;
}) {
  const displayValue = isCurrency ? fmt(value) : String(value);
  return (
    <div className={`rounded-xl bg-card p-5 glass-border ${highlight ? "ring-1 ring-gold/20" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold">{icon}</div>
      </div>
      <p className={`font-display text-2xl font-bold ${highlight ? "text-gold" : ""}`}>{displayValue}</p>
      {breakdown && <p className="text-[11px] text-muted-foreground mt-1">{breakdown}</p>}
    </div>
  );
}

function FunnelRow({ label, value, max, pct, drop }: {
  label: string; value: number; max: number; pct: number; drop?: number;
}) {
  const width = max > 0 ? Math.max((value / max) * 100, 4) : 4;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm">
          <span className="font-semibold">{value}</span>
          {pct < 100 && <span className="text-xs text-muted-foreground ml-1">({pct.toFixed(1)}%)</span>}
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-success/70 to-success transition-all duration-700"
          style={{ width: `${width}%` }}
        />
      </div>
      {drop !== undefined && drop > 0 && (
        <p className="text-[11px] text-destructive mt-0.5">↓ {drop.toFixed(1)}% de queda</p>
      )}
    </div>
  );
}

function UsersIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function CalendarIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
}
function CheckIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}
function DollarIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}

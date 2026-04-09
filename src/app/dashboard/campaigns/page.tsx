"use client";

import { useCallback, useEffect, useState } from "react";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";
import { CampaignMetrics, CampaignTotals } from "@/types";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

export default function CampaignsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [totals, setTotals] = useState<CampaignTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const fetchCampaigns = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/campaigns?${params}`)
      .then((res) => res.json())
      .then((json) => {
        setCampaigns(json.data ?? []);
        setTotals(json.totals ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, dateRange]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  const hasAdData = totals && totals.spend > 0;
  const chartCampaigns = campaigns.filter(c => c.spend > 0 || c.revenue > 0).sort((a, b) => b.spend - a.spend).slice(0, 5);
  const maxBar = Math.max(...chartCampaigns.map(c => Math.max(c.spend, c.revenue)), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Performance de Campanhas</h1>
        <p className="text-sm text-muted-foreground">Analise o ROI de cada campanha de marketing</p>
      </div>

      <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />

      {/* KPIs */}
      {totals && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl bg-card p-5 glass-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Investimento Total</p>
            <p className="font-display text-2xl font-bold mt-1">{fmt(totals.spend)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{fmtNum(totals.impressions)} impressoes · {fmtNum(totals.clicks)} cliques</p>
          </div>
          <div className="rounded-xl bg-card p-5 glass-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Receita Gerada</p>
            <p className="font-display text-2xl font-bold mt-1">{fmt(totals.revenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totals.procedimentos} procedimentos fechados</p>
          </div>
          <div className="rounded-xl bg-card p-5 glass-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">ROI</p>
            <p className={`font-display text-2xl font-bold mt-1 ${totals.roi !== null ? (totals.roi >= 0 ? "text-success" : "text-destructive") : ""}`}>
              {totals.roi !== null ? `${totals.roi.toFixed(0)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">(receita - investimento) / investimento</p>
          </div>
          <div className="rounded-xl bg-card p-5 glass-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">CPL Medio</p>
            <p className="font-display text-2xl font-bold mt-1">{totals.avgCpl !== null ? fmt(totals.avgCpl) : "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">custo por lead · {totals.leads} leads</p>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartCampaigns.length > 0 && hasAdData && (
        <div className="rounded-xl bg-card p-6 glass-border">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-lg font-semibold">Investimento vs Receita por Campanha</h2>
              <p className="text-xs text-muted-foreground">Comparativo direto de aporte e retorno financeiro</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/70" />Investimento</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" />Receita</span>
            </div>
          </div>
          <div className="space-y-4">
            {chartCampaigns.map((c) => (
              <div key={c.campaign} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate max-w-[300px]">{c.campaign}</span>
                  <span className="text-muted-foreground">{fmt(c.spend)}</span>
                </div>
                <div className="flex gap-1 h-3">
                  <div className="h-full rounded-full bg-destructive/60 transition-all duration-500" style={{ width: `${(c.spend / maxBar) * 100}%` }} />
                  <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${(c.revenue / maxBar) * 100}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Inv: {fmt(c.spend)}</span>
                  <span>Rec: {fmt(c.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl bg-card glass-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border/20">
          <h2 className="font-display font-semibold">Detalhamento por Campanha</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/20">
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Campanha</th>
              {hasAdData && <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Plataforma</th>}
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Leads</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Agend.</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Proc.</th>
              {hasAdData && (
                <>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Investimento</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">CPL</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">ROI</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">{loading ? "Carregando..." : "Nenhuma campanha encontrada"}</td></tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.campaign} className="border-b border-border/10 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium max-w-[250px] truncate">{c.campaign}</td>
                  {hasAdData && (
                    <td className="px-4 py-3">
                      {c.platform ? (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-gold/15 text-gold">
                          {c.platform === "meta" ? "Meta" : c.platform === "google" ? "Google" : "Meta+Google"}
                        </span>
                      ) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-right">{c.leads}</td>
                  <td className="px-4 py-3 text-sm text-right">{c.agendamentos}</td>
                  <td className="px-4 py-3 text-sm text-right">{c.procedimentos}</td>
                  {hasAdData && (
                    <>
                      <td className="px-4 py-3 text-sm text-right">{fmt(c.spend)}</td>
                      <td className="px-4 py-3 text-sm text-right">{c.costPerLead !== null ? fmt(c.costPerLead) : "—"}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {c.roi !== null ? (
                          <span className={c.roi >= 0 ? "text-success" : "text-destructive"}>{c.roi.toFixed(0)}%</span>
                        ) : "—"}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border/10">
          Exibindo {campaigns.length} campanhas ativas
        </div>
      </div>
    </div>
  );
}

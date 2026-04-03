"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClinic } from "@/hooks/use-clinic";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface DetailedMetrics {
  totalLeads: number;
  campaignLeads: number;
  organicLeads: number;
  agendamentos: number;
  procedimentos: number;
  totalRevenue: number;
  leadsChange: number | null;
  agendamentosChange: number | null;
  procedimentosChange: number | null;
  revenueChange: number | null;
  taxaLeadConsulta: number;
  taxaConsultaFechamento: number;
  taxaLeadFechamento: number;
  revenueByDay: { name: string; value: number }[];
  topProcedures: { name: string; count: number; revenue: number; ticketMedio: number; trend: number | null }[];
  channelPerformance: { source: string; leads: number; conversions: number; conversionRate: number; revenue: number }[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const fmtK = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : fmt(v);

function ChangeTag({ value }: { value: number | null }) {
  if (value === null) return null;
  const color = value >= 0 ? "text-green-600" : "text-red-500";
  return (
    <span className={`text-xs ${color}`}>
      {value >= 0 ? "+" : ""}{value}% vs periodo anterior
    </span>
  );
}

export default function DashboardPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [data, setData] = useState<DetailedMetrics | null>(null);
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
  const periodLabel = days === 7 ? "7 dias" : days === 30 ? "30 dias" : "Trimestre";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visao Geral</h1>
          <p className="text-sm text-muted-foreground">{clinic.name} — Dashboard completo</p>
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
        <p className="text-muted-foreground">Carregando metricas...</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Leads captados</p>
                <p className="text-3xl font-bold">{m.totalLeads}</p>
                <ChangeTag value={m.leadsChange} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Campanha: {m.campaignLeads} | Organico: {m.organicLeads}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Consultas agendadas</p>
                <p className="text-3xl font-bold">{m.agendamentos}</p>
                <ChangeTag value={m.agendamentosChange} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Procedimentos fechados</p>
                <p className="text-3xl font-bold">{m.procedimentos}</p>
                <ChangeTag value={m.procedimentosChange} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Receita gerada</p>
                <p className="text-3xl font-bold">{fmtK(m.totalRevenue)}</p>
                <ChangeTag value={m.revenueChange} />
              </CardContent>
            </Card>
          </div>

          {/* Funil + Receita por período */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Funil de conversao</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Leads captados", value: m.totalLeads, pct: null, color: "bg-emerald-800" },
                  { label: "Consultas agendadas", value: m.agendamentos, pct: m.taxaLeadConsulta, color: "bg-emerald-600" },
                  { label: "Fecharam procedimento", value: m.procedimentos, pct: m.taxaConsultaFechamento, color: "bg-emerald-400" },
                ].map((stage, i, arr) => {
                  const maxVal = arr[0].value || 1;
                  const width = (stage.value / maxVal) * 100;
                  const drop = i > 0 ? (100 - (stage.value / (arr[i - 1].value || 1)) * 100) : null;
                  return (
                    <div key={stage.label} className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-medium">{stage.label}</span>
                        <span className="text-sm">
                          <span className="font-bold">{stage.value}</span>
                          {stage.pct !== null && (
                            <span className="ml-1 text-muted-foreground">({stage.pct.toFixed(1)}%)</span>
                          )}
                        </span>
                      </div>
                      <div className="h-8 w-full rounded bg-muted">
                        <div
                          className={`h-full rounded ${stage.color} transition-all`}
                          style={{ width: `${Math.max(width, 2)}%` }}
                        />
                      </div>
                      {drop !== null && drop > 0 && (
                        <p className="text-xs text-red-500">&darr; {drop.toFixed(1)}% de queda</p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Receita por periodo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={m.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value) => [fmt(Number(value)), "Receita"]}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="value" fill="#166534" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance por canal + Top procedimentos */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Performance por canal</CardTitle>
                  <span className="text-xs text-muted-foreground">Top {Math.min(m.channelPerformance.length, 3)}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {m.channelPerformance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados de campanhas no periodo</p>
                ) : (
                  m.channelPerformance.slice(0, 3).map((ch) => (
                    <div key={ch.source} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium capitalize">{ch.source}</p>
                        <p className="text-xs text-muted-foreground">
                          {ch.leads} leads &middot; {ch.conversionRate.toFixed(0)}% conv.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{fmtK(ch.revenue)}</p>
                      </div>
                    </div>
                  ))
                )}
                {m.organicLeads > 0 && (
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="font-medium">Organico</p>
                      <p className="text-xs text-muted-foreground">{m.organicLeads} leads</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Top procedimentos</CardTitle>
                  <span className="text-xs text-muted-foreground">Top {Math.min(m.topProcedures.length, 3)}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {m.topProcedures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem procedimentos no periodo</p>
                ) : (
                  m.topProcedures.slice(0, 3).map((proc) => (
                    <div key={proc.name} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium">{proc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {proc.count} fechados &middot; TM {fmtK(proc.ticketMedio)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{fmtK(proc.revenue)}</p>
                        {proc.trend !== null && (
                          <p className={`text-xs ${proc.trend >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {proc.trend >= 0 ? "+" : ""}{proc.trend}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Insight automático */}
          {m.topProcedures.length > 0 && m.channelPerformance.length > 0 && (
            <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
              <CardContent className="pt-6">
                <p className="font-semibold text-blue-700">Insight automatico</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nos ultimos {periodLabel}, o procedimento mais rentavel foi{" "}
                  <strong>{m.topProcedures[0].name}</strong> com{" "}
                  {fmt(m.topProcedures[0].revenue)} de receita
                  ({m.topProcedures[0].count} fechamentos, ticket medio de {fmt(m.topProcedures[0].ticketMedio)}).
                  {m.channelPerformance.length > 0 && (
                    <> O canal <strong className="capitalize">{m.channelPerformance[0].source}</strong> gerou{" "}
                    a maior receita ({fmtK(m.channelPerformance[0].revenue)}) com taxa de conversao de{" "}
                    {m.channelPerformance[0].conversionRate.toFixed(0)}%.
                    </>
                  )}
                  {m.taxaLeadFechamento > 0 && (
                    <> Taxa geral de lead para fechamento: <strong>{m.taxaLeadFechamento.toFixed(1)}%</strong>.</>
                  )}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

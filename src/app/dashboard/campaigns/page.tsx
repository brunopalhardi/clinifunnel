"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateFilter } from "@/components/dashboard/date-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClinic } from "@/hooks/use-clinic";
import { CampaignMetrics, CampaignTotals } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(v);

const fmtPct = (v: number | null) =>
  v !== null ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}%` : "-";

function platformLabel(p: string | null) {
  if (p === "meta") return "Meta";
  if (p === "google") return "Google";
  if (p === "both") return "Meta + Google";
  return "—";
}

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

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  if (clinicLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  const hasAdData = totals && totals.spend > 0;

  // Dados para gráfico comparativo
  const chartData = campaigns
    .filter((c) => c.revenue > 0 || c.spend > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((c) => ({
      name: c.campaign.length > 20 ? c.campaign.slice(0, 20) + "..." : c.campaign,
      Receita: c.revenue,
      Investimento: c.spend,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Performance por Campanha</h1>
        {loading && (
          <span className="text-sm text-muted-foreground">Carregando...</span>
        )}
      </div>

      <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />

      {/* KPIs */}
      {totals && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Investimento Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(totals.spend)}</p>
              <p className="text-xs text-muted-foreground">
                {fmtNum(totals.impressions)} impressoes &middot; {fmtNum(totals.clicks)} cliques
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita Gerada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(totals.revenue)}</p>
              <p className="text-xs text-muted-foreground">
                {totals.procedimentos} procedimentos fechados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ROI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${
                  totals.roi !== null
                    ? totals.roi >= 0
                      ? "text-green-600"
                      : "text-red-600"
                    : ""
                }`}
              >
                {totals.roi !== null ? `${totals.roi.toFixed(0)}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                (receita - investimento) / investimento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                CPL Medio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {totals.avgCpl !== null ? fmt(totals.avgCpl) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                custo por lead &middot; {totals.leads} leads
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráfico Investimento vs Receita */}
      {chartData.length > 0 && hasAdData && (
        <Card>
          <CardHeader>
            <CardTitle>Investimento vs Receita por Campanha</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                  }
                />
                <Tooltip
                  formatter={(value) => [fmt(Number(value)), undefined]}
                  labelFormatter={(label) => String(label)}
                />
                <Legend />
                <Bar dataKey="Investimento" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Receita" fill="#166534" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Campanhas */}
      <Card>
        <CardHeader>
          <CardTitle>Campanhas ({campaigns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                {hasAdData && <TableHead>Plataforma</TableHead>}
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Agendamentos</TableHead>
                <TableHead className="text-right">Procedimentos</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                {hasAdData && (
                  <>
                    <TableHead className="text-right">Investimento</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={hasAdData ? 9 : 5}
                    className="text-center text-muted-foreground"
                  >
                    Nenhuma campanha encontrada
                  </TableCell>
                </TableRow>
              ) : (
                campaigns
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((c) => (
                    <TableRow key={c.campaign}>
                      <TableCell className="max-w-48 truncate font-medium">
                        {c.campaign}
                      </TableCell>
                      {hasAdData && (
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {platformLabel(c.platform)}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right">{c.leads}</TableCell>
                      <TableCell className="text-right">{c.agendamentos}</TableCell>
                      <TableCell className="text-right">{c.procedimentos}</TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(c.revenue)}
                      </TableCell>
                      {hasAdData && (
                        <>
                          <TableCell className="text-right">{fmt(c.spend)}</TableCell>
                          <TableCell className="text-right">
                            {c.costPerLead !== null ? fmt(c.costPerLead) : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              c.roi !== null
                                ? c.roi >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                                : ""
                            }`}
                          >
                            {fmtPct(c.roi)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

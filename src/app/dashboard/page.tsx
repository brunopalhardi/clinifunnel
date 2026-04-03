"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
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
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!clinic) {
    return (
      <p className="text-muted-foreground">
        Nenhuma clinica encontrada. Configure uma clinica para comecar.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Visao Geral</h1>
        {loading && (
          <span className="text-sm text-muted-foreground">Atualizando...</span>
        )}
      </div>
      <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />
      <KpiCards metrics={metrics} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Funil</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelChart metrics={metrics} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.totalLeads === 0 ? (
              <p className="text-sm text-muted-foreground">
                Configure as integracoes com Kommo e Clinicorp em Configuracoes
                para comecar a receber dados.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">{metrics.conversionRate.toFixed(1)}%</span>{" "}
                  dos leads agendaram consulta
                </p>
                <p>
                  <span className="font-medium">
                    {metrics.totalLeads > 0
                      ? ((metrics.campaignLeads / metrics.totalLeads) * 100).toFixed(0)
                      : 0}
                    %
                  </span>{" "}
                  dos leads vem de campanhas
                </p>
                {metrics.procedimentos > 0 && (
                  <p>
                    Ticket medio:{" "}
                    <span className="font-medium">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(metrics.totalRevenue / metrics.procedimentos)}
                    </span>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

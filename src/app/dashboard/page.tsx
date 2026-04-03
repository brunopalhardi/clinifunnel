"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { FunnelMetrics } from "@/types";

// TODO: Replace with real data from API
const mockMetrics: FunnelMetrics = {
  totalLeads: 0,
  campaignLeads: 0,
  organicLeads: 0,
  agendamentos: 0,
  procedimentos: 0,
  totalRevenue: 0,
  conversionRate: 0,
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Visao Geral</h1>
      <KpiCards metrics={mockMetrics} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Funil</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelChart metrics={mockMetrics} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure as integracoes com Kommo e Clinicorp em Configuracoes
              para comecar a receber dados.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelMetrics } from "@/types";

interface KpiCardsProps {
  metrics: FunnelMetrics;
}

export function KpiCards({ metrics }: KpiCardsProps) {
  const cards = [
    {
      title: "Total de Leads",
      value: metrics.totalLeads,
      subtitle: `${metrics.campaignLeads} campanha | ${metrics.organicLeads} organico`,
    },
    {
      title: "Agendamentos",
      value: metrics.agendamentos,
      subtitle: `${metrics.totalLeads > 0 ? ((metrics.agendamentos / metrics.totalLeads) * 100).toFixed(1) : 0}% dos leads`,
    },
    {
      title: "Procedimentos",
      value: metrics.procedimentos,
      subtitle: `${metrics.agendamentos > 0 ? ((metrics.procedimentos / metrics.agendamentos) * 100).toFixed(1) : 0}% dos agendamentos`,
    },
    {
      title: "Receita Total",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(metrics.totalRevenue),
      subtitle: `${metrics.procedimentos > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metrics.totalRevenue / metrics.procedimentos) : "R$ 0"} / procedimento`,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

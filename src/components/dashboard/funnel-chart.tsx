"use client";

import { FunnelMetrics } from "@/types";

interface FunnelChartProps {
  metrics: FunnelMetrics;
}

export function FunnelChart({ metrics }: FunnelChartProps) {
  const stages = [
    { label: "Leads", value: metrics.totalLeads, color: "bg-blue-500" },
    { label: "Agendamentos", value: metrics.agendamentos, color: "bg-yellow-500" },
    { label: "Procedimentos", value: metrics.procedimentos, color: "bg-green-500" },
  ];

  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Funil de Vendas</h3>
      <div className="space-y-3">
        {stages.map((stage) => (
          <div key={stage.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{stage.label}</span>
              <span className="font-semibold">{stage.value}</span>
            </div>
            <div className="h-8 w-full rounded bg-muted">
              <div
                className={`h-full rounded ${stage.color} transition-all`}
                style={{
                  width: `${(stage.value / maxValue) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

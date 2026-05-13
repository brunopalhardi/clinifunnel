"use client";

import { useCallback, useEffect, useState } from "react";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";

interface AppointmentsBreakdown {
  total: number;
  atendidos: number;
  faltaram: number;
  confirmadas: number;
  aguardando: number;
  emEspera: number;
  emAtendimento: number;
  atrasadas: number;
  taxaNoShow: number;
}

interface DiscountsBreakdown {
  total: number;
  percent: number;
  proceduresWithDiscount: number;
  revenueBruto: number;
}

interface OperacaoData {
  totalRevenue: number;
  totalProcedures: number;
  ticketMedio: number;
  activePatients: number;
  pendingRevenue: number;
  pendingCount: number;
  cancelledRevenue: number;
  cancelledCount: number;
  topProcedures: { name: string; count: number; revenue: number; ticketMedio: number }[];
  procedureBreakdown: { status: string; count: number; revenue: number }[];
  revenueByDay: { day: string; revenue: number; count: number }[];
  appointments?: AppointmentsBreakdown;
  discounts?: DiscountsBreakdown;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : fmt(v);
const fmtDate = (d: string) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

const statusLabel: Record<string, string> = {
  Aprovado: "Aprovado",
  "Orçamento": "Orçamento",
  Cancelado: "Cancelado",
  completed: "Concluido",
  approved: "Aprovado",
  pending: "Pendente",
  cancelled: "Cancelado",
};
const statusColor: Record<string, string> = {
  Aprovado: "text-success",
  approved: "text-success",
  "Orçamento": "text-muted-foreground",
  pending: "text-muted-foreground",
  Cancelado: "text-destructive",
  cancelled: "text-destructive",
  completed: "text-success",
};

const empty: OperacaoData = {
  totalRevenue: 0, totalProcedures: 0, ticketMedio: 0, activePatients: 0,
  pendingRevenue: 0, pendingCount: 0, cancelledRevenue: 0, cancelledCount: 0,
  topProcedures: [], procedureBreakdown: [], revenueByDay: [],
};

export default function OperacaoPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [data, setData] = useState<OperacaoData>(empty);
  const [, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const fetchData = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/operacao?${params}`)
      .then((res) => res.json())
      .then((json) => setData(json.data ?? empty))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  const d = data;
  const maxRevenue = Math.max(...d.revenueByDay.map((r) => r.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Operacao da Clinica</h1>
          <p className="text-sm text-muted-foreground">
            {clinic?.name} — Origem: Clinicorp (toda a clinica, sem filtro de funil)
          </p>
        </div>
        <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />
      </div>

      {/* Linha 1 — Financeiro */}
      <div>
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Financeiro
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Receita confirmada"
            value={fmt(d.totalRevenue)}
            breakdown={`${d.totalProcedures} procedimentos`}
            highlight
          />
          <KpiCard
            label="Ticket medio"
            value={fmt(d.ticketMedio)}
            breakdown="Por procedimento"
          />
          <KpiCard
            label="Pacientes ativos"
            value={String(d.activePatients)}
            breakdown="No periodo"
          />
          <KpiCard
            label="Pipeline pendente"
            value={fmt(d.pendingRevenue)}
            breakdown={`${d.pendingCount} aguardando`}
          />
        </div>

        {/* [DASH-5.1] Desconto concedido no periodo */}
        {d.discounts && d.discounts.total > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Descontos concedidos
              </p>
              <p className="font-display text-2xl font-bold mt-1">
                {fmt(d.discounts.total)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {d.discounts.proceduresWithDiscount} procedimento(s) com desconto · {d.discounts.percent.toFixed(1)}% sobre a receita bruta
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Receita bruta: <span className="font-semibold text-foreground">{fmt(d.discounts.revenueBruto)}</span></p>
              <p>− Descontos: <span className="font-semibold text-amber-600 dark:text-amber-400">{fmt(d.discounts.total)}</span></p>
              <p>= Receita liquida: <span className="font-semibold text-success">{fmt(d.totalRevenue)}</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Linha 2 — Agenda (Appointments) */}
      {d.appointments && d.appointments.total > 0 && (
        <div>
          <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Agenda da Clinica
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Atendidos"
              value={String(d.appointments.atendidos)}
              breakdown={`${d.appointments.total} appointments no periodo`}
              highlight
            />
            <KpiCard
              label="Faltas"
              value={String(d.appointments.faltaram)}
              breakdown={d.appointments.atendidos + d.appointments.faltaram > 0
                ? `${d.appointments.taxaNoShow.toFixed(1)}% no-show`
                : undefined}
            />
            <KpiCard
              label="Confirmadas (pendentes)"
              value={String(d.appointments.confirmadas)}
              breakdown="Confirmou, ainda nao veio"
            />
            <KpiCard
              label="Aguardando status"
              value={String(d.appointments.aguardando)}
              breakdown="Sem update no Clinicorp ainda"
            />
          </div>
        </div>
      )}

      {/* Receita por dia + Top procedimentos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-5">Receita por dia</h2>
          {d.revenueByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no periodo.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {d.revenueByDay.map((r) => (
                <div key={r.day} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">{fmtDate(r.day)}</span>
                  <div className="flex-1 h-7 rounded-md bg-muted overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-success/70 to-success transition-all"
                      style={{ width: `${(r.revenue / maxRevenue) * 100}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-2">
                      <span className="text-[10px] font-semibold">{r.count} proc.</span>
                      <span className="text-[11px] font-semibold">{fmtK(r.revenue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-5">Top procedimentos</h2>
          {d.topProcedures.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum procedimento.</p>
          ) : (
            <div className="space-y-3">
              {d.topProcedures.map((p) => (
                <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.count} executados · TM {fmtK(p.ticketMedio)}</p>
                  </div>
                  <p className="text-sm font-semibold ml-3">{fmtK(p.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="rounded-xl bg-card p-6 glass-border">
        <h2 className="font-display text-lg font-semibold mb-5">Distribuicao por status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {d.procedureBreakdown.map((s) => (
            <div key={s.status} className="rounded-lg border border-border/30 p-4">
              <p className={`text-xs uppercase tracking-wide ${statusColor[s.status] ?? "text-muted-foreground"}`}>
                {statusLabel[s.status] ?? s.status}
              </p>
              <p className="font-display text-xl font-bold mt-1">{s.count}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmt(s.revenue)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, breakdown, highlight }: {
  label: string; value: string; breakdown?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-card p-5 glass-border ${highlight ? "ring-1 ring-primary/20" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl font-bold mt-2 ${highlight ? "text-primary" : ""}`}>{value}</p>
      {breakdown && <p className="text-[11px] text-muted-foreground mt-1">{breakdown}</p>}
    </div>
  );
}

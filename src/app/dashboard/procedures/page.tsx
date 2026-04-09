"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";

interface Procedure {
  id: string;
  name: string;
  value: number;
  status: string;
  completedAt: string | null;
  createdAt: string;
  patient: { name: string };
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusStyles: Record<string, string> = {
  completed: "bg-success/15 text-success",
  approved: "bg-gold/15 text-gold",
  pending: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive",
};
const statusLabels: Record<string, string> = {
  completed: "Concluido", approved: "Aprovado", pending: "Pendente", cancelled: "Cancelado",
};

const DONUT_COLORS = [
  "hsl(0, 70%, 55%)", "hsl(160, 70%, 45%)", "hsl(220, 70%, 55%)",
  "hsl(38, 85%, 55%)", "hsl(280, 60%, 55%)", "hsl(180, 60%, 45%)",
  "hsl(45, 80%, 55%)", "hsl(340, 60%, 55%)", "hsl(100, 50%, 45%)",
];

export default function ProceduresPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchProcedures = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/procedures?${params}`)
      .then((res) => res.json())
      .then((json) => setProcedures(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, dateRange]);

  useEffect(() => { fetchProcedures(); }, [fetchProcedures]);

  // Group by procedure name
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const p of procedures) {
      if (p.status === "cancelled") continue;
      const existing = map.get(p.name);
      if (existing) {
        existing.count++;
        existing.revenue += p.value;
      } else {
        map.set(p.name, { name: p.name, count: 1, revenue: p.value });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [procedures]);

  const totalRevenue = grouped.reduce((s, g) => s + g.revenue, 0);

  const filtered = procedures.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.patient.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Procedimentos</h1>
          <p className="text-sm text-muted-foreground">Receita e performance por tipo de procedimento</p>
        </div>
        <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />
      </div>

      {/* Donut + Ranking Table */}
      {grouped.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Donut Chart */}
          <div className="rounded-xl bg-card p-6 glass-border">
            <h2 className="font-display text-lg font-semibold mb-4">Distribuicao de receita</h2>
            <div className="flex flex-col items-center">
              <DonutChart data={grouped} total={totalRevenue} />
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4">
                {grouped.slice(0, 7).map((g, i) => (
                  <div key={g.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="text-[11px] text-muted-foreground">{g.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">Receita total</p>
                <p className="font-display text-2xl font-bold">{fmt(totalRevenue)}</p>
              </div>
            </div>
          </div>

          {/* Ranking Table */}
          <div className="rounded-xl bg-card p-6 glass-border">
            <h2 className="font-display text-lg font-semibold mb-4">Todos os procedimentos</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="py-2 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium w-8">#</th>
                  <th className="py-2 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Procedimento</th>
                  <th className="py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Qtd</th>
                  <th className="py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Receita</th>
                  <th className="py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ticket medio</th>
                  <th className="py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g, i) => {
                  const tm = g.count > 0 ? g.revenue / g.count : 0;
                  const trend = Math.floor(Math.random() * 50) - 10; // placeholder
                  return (
                    <tr key={g.name} className="border-b border-border/10">
                      <td className="py-2.5 text-sm text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 text-sm font-medium">{g.name}</td>
                      <td className="py-2.5 text-sm text-right">{g.count}</td>
                      <td className="py-2.5 text-sm text-right font-medium">{fmt(g.revenue)}</td>
                      <td className="py-2.5 text-sm text-right text-muted-foreground">{fmt(tm)}</td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${trend >= 0 ? "text-success border border-success/30" : "text-destructive border border-destructive/30"}`}>
                          {trend >= 0 ? "+" : ""}{trend}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="Buscar por paciente ou procedimento..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg bg-card py-2.5 pl-10 pr-4 text-sm glass-border outline-none focus:ring-1 focus:ring-gold/40 placeholder:text-muted-foreground/50" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg bg-card px-3 py-2.5 text-sm glass-border outline-none">
          <option value="all">Status: Todos</option>
          <option value="completed">Concluido</option>
          <option value="approved">Aprovado</option>
          <option value="pending">Pendente</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {/* Detail Table */}
      <div className="rounded-xl bg-card glass-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border/20">
          <h2 className="font-display font-semibold">Detalhamento individual</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/20">
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Procedimento</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Paciente</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Valor</th>
              <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">{loading ? "Carregando..." : "Nenhum procedimento encontrado"}</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/10 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{p.patient.name}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{fmt(p.value)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusStyles[p.status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabels[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                    {new Date(p.completedAt || p.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border/10">
            Mostrando {filtered.length} de {procedures.length}
          </div>
        )}
      </div>
    </div>
  );
}

// --- SVG Donut Chart ---
function DonutChart({ data, total }: { data: { name: string; revenue: number }[]; total: number }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 80;
  const stroke = 32;

  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const pct = total > 0 ? d.revenue / total : 0;
        const dashLen = pct * circumference;
        const dashOffset = -offset;
        offset += dashLen;
        return (
          <circle
            key={d.name}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
            strokeWidth={stroke}
            strokeDasharray={`${dashLen} ${circumference - dashLen}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="transition-all duration-500"
          />
        );
      })}
      {/* Inner circle for donut hole */}
      <circle cx={cx} cy={cy} r={radius - stroke / 2 - 4} fill="hsl(var(--card))" />
    </svg>
  );
}

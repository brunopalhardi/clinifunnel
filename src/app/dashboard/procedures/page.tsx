"use client";

import { useCallback, useEffect, useState } from "react";
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
  campaign?: string;
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
  completed: "Concluido",
  approved: "Aprovado",
  pending: "Pendente",
  cancelled: "Cancelado",
};

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

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  const completed = procedures.filter(p => p.status === "completed").length;
  const totalRevenue = procedures.filter(p => p.status === "completed" || p.status === "approved").reduce((s, p) => s + p.value, 0);
  const ticketMedio = completed > 0 ? totalRevenue / completed : 0;

  const filtered = procedures.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.patient.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Procedimentos Realizados</h1>
        <p className="text-sm text-muted-foreground">Acompanhe todos os tratamentos e orcamentos da clinica</p>
      </div>

      <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total de Procedimentos</p>
          <p className="font-display text-2xl font-bold mt-1">{procedures.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">ultimos 30 dias</p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Receita Total</p>
          <p className="font-display text-2xl font-bold text-gold mt-1">{fmt(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmt(ticketMedio)} / procedimento</p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Concluidos</p>
          <p className="font-display text-2xl font-bold text-success mt-1">{completed}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{procedures.length > 0 ? ((completed / procedures.length) * 100).toFixed(1) : 0}% dos procedimentos</p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Ticket Medio</p>
          <p className="font-display text-2xl font-bold mt-1">{ticketMedio > 0 ? fmt(ticketMedio) : "—"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">por orcamento aprovado</p>
        </div>
      </div>

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

      <div className="rounded-xl bg-card glass-border overflow-hidden">
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

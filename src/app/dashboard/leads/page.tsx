"use client";

import { useCallback, useEffect, useState } from "react";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  channel: string;
  utmCampaign: string | null;
  kommoStatus: string | null;
  agendamentoAt: string | null;
  createdAt: string;
}

const statusStyles: Record<string, string> = {
  novo: "bg-gold/15 text-gold",
  agendado: "bg-success/15 text-success",
  convertido: "bg-success/20 text-success font-medium",
  perdido: "bg-destructive/15 text-destructive",
};

export default function LeadsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");

  const fetchLeads = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/leads?${params}`)
      .then((res) => res.json())
      .then((json) => setLeads(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, dateRange]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  const campaignLeads = leads.filter((l) => l.channel === "campaign").length;
  const organicLeads = leads.filter((l) => l.channel !== "campaign").length;

  const filtered = leads.filter((l) => {
    if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !(l.phone || "").includes(search)) return false;
    if (channelFilter !== "all" && l.channel !== channelFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Leads</h1>
        <p className="text-sm text-muted-foreground">Gerencie e acompanhe todos os leads da clinica</p>
      </div>

      <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />

      {/* KPI Mini Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total de Leads</p>
          <p className="font-display text-2xl font-bold mt-1">{leads.length}</p>
        </div>
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Via Campanha</p>
          <p className="font-display text-2xl font-bold mt-1">{campaignLeads} <span className="text-sm text-success font-normal">{leads.length > 0 ? `${((campaignLeads / leads.length) * 100).toFixed(0)}% do total` : ""}</span></p>
        </div>
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Via Organico</p>
          <p className="font-display text-2xl font-bold mt-1">{organicLeads} <span className="text-sm text-muted-foreground font-normal">{leads.length > 0 ? `${((organicLeads / leads.length) * 100).toFixed(0)}% do total` : ""}</span></p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-card py-2.5 pl-10 pr-4 text-sm glass-border outline-none focus:ring-1 focus:ring-gold/40 placeholder:text-muted-foreground/50"
          />
        </div>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="rounded-lg bg-card px-3 py-2.5 text-sm glass-border outline-none"
        >
          <option value="all">Canal: Todos</option>
          <option value="campaign">Campanha</option>
          <option value="organic">Organico</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card glass-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30">
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Nome</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Telefone</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Canal</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">UTM Campaign</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Agendamento</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">{loading ? "Carregando..." : "Nenhum lead encontrado"}</td></tr>
            ) : (
              filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-border/10 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium">{lead.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{lead.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${lead.channel === "campaign" ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"}`}>
                      {lead.channel === "campaign" ? "Campanha" : "Organico"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{lead.utmCampaign || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusStyles[lead.kommoStatus?.toLowerCase() || ""] || "bg-muted text-muted-foreground"}`}>
                      {lead.kommoStatus || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {lead.agendamentoAt ? new Date(lead.agendamentoAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border/10">
            Mostrando {filtered.length} de {leads.length} leads
          </div>
        )}
      </div>
    </div>
  );
}

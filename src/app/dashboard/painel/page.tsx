"use client";

// [DASH-14] Painel Principal — KPIs executivos (call Sérgio 08/06):
// ticket médio por paciente (global / novo / recorrente) + tabela por doutora.
// Por-doutora vem de Procedure.dentistName (100% populado em prod).
// Appointment.dentistName é null em prod — não usar (vistoria DASH-12).

import { useCallback, useEffect, useState } from "react";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";
import { useStickyDateRange } from "@/hooks/use-sticky-date-range";

interface PatientTicket {
  patients: number;
  revenue: number;
  ticketMedio: number;
}

interface DentistTicket {
  dentistName: string;
  patients: number;
  revenue: number;
  ticketMedio: number;
}

interface PainelData {
  ticketGlobal: PatientTicket;
  ticketNovo: PatientTicket;
  ticketRecorrente: PatientTicket;
  porDoutora: DentistTicket[];
}

const emptyTicket: PatientTicket = { patients: 0, revenue: 0, ticketMedio: 0 };
const empty: PainelData = {
  ticketGlobal: emptyTicket,
  ticketNovo: emptyTicket,
  ticketRecorrente: emptyTicket,
  porDoutora: [],
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function PainelPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const { initialPreset, save: saveDatePreset } = useStickyDateRange();
  const [data, setData] = useState<PainelData>(empty);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const fetchData = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/painel?${params}`)
      .then((res) => res.json())
      .then((json) => setData(json.data ?? empty))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  const d = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Painel Principal
            {loading && <span className="ml-3 text-xs font-normal text-muted-foreground">Atualizando…</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {clinic?.name} — Ticket médio por paciente · Origem: Clinicorp (procedimentos aprovados)
          </p>
        </div>
        <DateFilter
          defaultPreset={initialPreset}
          onFilter={(from, to, presetId) => {
            setDateRange({ from, to });
            saveDatePreset(presetId);
          }}
        />
      </div>

      {/* Linha 1 — KPI cards: ticket por paciente */}
      <div>
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Ticket médio por paciente
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Ticket médio"
            subtitle="por paciente"
            value={fmt(d.ticketGlobal.ticketMedio)}
            breakdown={`${d.ticketGlobal.patients} paciente(s) · ${fmt(d.ticketGlobal.revenue)}`}
            highlight
          />
          <KpiCard
            label="Ticket médio — paciente novo"
            value={fmt(d.ticketNovo.ticketMedio)}
            breakdown={`${d.ticketNovo.patients} paciente(s) · ${fmt(d.ticketNovo.revenue)}`}
          />
          <KpiCard
            label="Ticket médio — paciente recorrente"
            value={fmt(d.ticketRecorrente.ticketMedio)}
            breakdown={`${d.ticketRecorrente.patients} paciente(s) · ${fmt(d.ticketRecorrente.revenue)}`}
          />
          <KpiCard
            label="Pacientes no período"
            value={String(d.ticketGlobal.patients)}
            breakdown={`Receita total: ${fmt(d.ticketGlobal.revenue)}`}
          />
        </div>
      </div>

      {/* Tabela por doutora */}
      <div className="rounded-xl bg-card p-6 glass-border">
        <h2 className="font-display text-lg font-semibold mb-5">Por doutora</h2>
        {d.porDoutora.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Doutora
                  </th>
                  <th className="pb-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Pacientes
                  </th>
                  <th className="pb-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Receita
                  </th>
                  <th className="pb-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Ticket médio
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.porDoutora.map((row) => (
                  <tr
                    key={row.dentistName}
                    className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium">
                      {row.dentistName === "Sem dentista" ? (
                        <span className="text-muted-foreground">
                          {row.dentistName}
                          <span
                            className="ml-1.5 text-[10px] text-muted-foreground/60"
                            title="Procedimentos antigos sem dentista sincronizado via Clinicorp"
                          >
                            (procedimentos sem dentista sincronizado)
                          </span>
                        </span>
                      ) : (
                        row.dentistName
                      )}
                    </td>
                    <td className="py-3 text-right tabular-nums">{row.patients}</td>
                    <td className="py-3 text-right tabular-nums">{fmt(row.revenue)}</td>
                    <td className="py-3 text-right tabular-nums font-semibold">
                      {fmt(row.ticketMedio)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  subtitle,
  value,
  breakdown,
  highlight,
}: {
  label: string;
  subtitle?: string;
  value: string;
  breakdown?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-card p-5 glass-border ${highlight ? "ring-1 ring-primary/20" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      {subtitle && (
        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mt-0.5">{subtitle}</p>
      )}
      <p className={`font-display text-2xl font-bold mt-2 ${highlight ? "text-primary" : ""}`}>{value}</p>
      {breakdown && <p className="text-[11px] text-muted-foreground mt-1">{breakdown}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface PatientProfile {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  canalProspeccao: string | null;
  utms: { source?: string; medium?: string; campaign?: string; content?: string };
  totalRevenue: number;
  procedureCount: number;
  firstContact: string | null;
  lastProcedure: { name: string; date: string; value: number } | null;
  procedures: { id: string; name: string; value: number; status: string; completedAt: string | null; createdAt: string }[];
  timeline: { date: string; type: string; description: string }[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtFull = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const statusColors: Record<string, string> = {
  completed: "bg-green-500/15 text-green-400",
  approved: "bg-blue-500/15 text-blue-400",
  pending: "bg-yellow-500/15 text-yellow-400",
  cancelled: "bg-red-500/15 text-red-400",
};

const timelineIcons: Record<string, string> = {
  lead: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
  agendamento: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  procedure: "M20 6 9 17l-5-5",
};

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then((res) => res.json())
      .then((json) => setProfile(json.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-muted-foreground p-8">Carregando...</p>;
  if (!profile) return <p className="text-destructive p-8">Paciente nao encontrado.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/patients" className="mt-1 rounded-lg p-2 hover:bg-muted/10 transition-colors">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">{profile.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {profile.phone && <span className="text-sm text-muted-foreground">{profile.phone}</span>}
            {profile.canalProspeccao && (
              <span className="inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
                {profile.canalProspeccao}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="font-display text-2xl font-bold text-gold">{fmt(profile.totalRevenue)}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Primeiro Contato</p>
          <p className="text-sm font-semibold mt-1">{fmtDate(profile.firstContact)}</p>
        </div>
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Procedimentos</p>
          <p className="text-sm font-semibold mt-1">{profile.procedureCount}</p>
        </div>
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ultimo Procedimento</p>
          <p className="text-sm font-semibold mt-1">
            {profile.lastProcedure ? `${profile.lastProcedure.name} (${fmtDate(profile.lastProcedure.date)})` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Canal / UTM</p>
          <p className="text-sm font-semibold mt-1">{profile.canalProspeccao ?? "—"}</p>
          {profile.utms.campaign && (
            <p className="text-xs text-muted-foreground mt-0.5">Campanha: {profile.utms.campaign}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timeline */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-4">Jornada do Paciente</h2>
          <div className="space-y-4">
            {profile.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
            ) : (
              profile.timeline.map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/20 shrink-0">
                      <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={timelineIcons[event.type] ?? timelineIcons.procedure} />
                      </svg>
                    </div>
                    {i < profile.timeline.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">{event.description}</p>
                    <p className="text-xs text-muted-foreground">{fmtFull(event.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Procedures */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-4">Procedimentos</h2>
          <div className="space-y-3">
            {profile.procedures.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum procedimento registrado.</p>
            ) : (
              profile.procedures.map((proc) => (
                <div key={proc.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{proc.name}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(proc.completedAt ?? proc.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColors[proc.status] ?? "bg-muted text-muted-foreground"}`}>
                      {proc.status}
                    </span>
                    <span className="text-sm font-semibold">{fmt(proc.value)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

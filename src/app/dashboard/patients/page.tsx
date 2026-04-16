"use client";

import { useCallback, useEffect, useState } from "react";
import { useClinic } from "@/hooks/use-clinic";
import Link from "next/link";

interface PatientRow {
  id: string;
  name: string;
  phone: string | null;
  canal: string;
  totalRevenue: number;
  procedureCount: number;
  firstContact: string;
  lastProcedure: string | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function PatientsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(() => {
    if (!clinic) return;
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (search) params.set("search", search);
    fetch(`/api/patients?${params}`)
      .then((res) => res.json())
      .then((json) => setPatients(json.data ?? []))
      .catch(() => {});
  }, [clinic, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Visao completa de todos os pacientes do funil</p>
        </div>
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50 w-72"
        />
      </div>

      <div className="rounded-xl bg-card glass-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Telefone</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Canal</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Procedimentos</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Receita</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Primeiro Contato</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Ultimo Proc.</th>
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/5 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/patients/${p.id}`} className="font-medium hover:text-gold transition-colors">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
                        {p.canal}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{p.procedureCount}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(p.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtDate(p.firstContact)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtDate(p.lastProcedure)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

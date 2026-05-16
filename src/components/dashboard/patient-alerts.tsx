"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Reminder {
  key: string;
  type: "recall" | "inactive" | "postconsulta";
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  procedureName: string | null;
  daysUntilDue: number;
  description: string;
}

interface GroupedData {
  overdue: Reminder[];
  urgent: Reminder[];
  upcoming: Reminder[];
  counts: { recall: number; inactive: number; postconsulta: number; total: number };
}

type ActionKind = "TRATADO" | "ADIADO_7" | "ADIADO_30" | "DISPENSADO";

function iconFor(t: Reminder["type"]): string {
  if (t === "recall") return "RC";
  if (t === "inactive") return "IN";
  return "PC";
}

interface Props {
  onCountChange?: (total: number) => void;
}

export function PatientAlerts({ onCountChange }: Props) {
  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    setLoading(true);
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((json) => {
        const d: GroupedData = json.data;
        setData(d);
        onCountChange?.(d.counts.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [onCountChange]);

  useEffect(() => {
    reload();
  }, [reload]);

  const optimisticRemove = (key: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const filter = (arr: Reminder[]) => arr.filter((r) => r.key !== key);
      const next: GroupedData = {
        overdue: filter(prev.overdue),
        urgent: filter(prev.urgent),
        upcoming: filter(prev.upcoming),
        counts: {
          ...prev.counts,
          total: prev.counts.total - 1,
        },
      };
      onCountChange?.(next.counts.total);
      return next;
    });
  };

  async function handleAction(r: Reminder, kind: ActionKind) {
    setOpenMenu(null);
    const newBusy = new Set(busy);
    newBusy.add(r.key);
    setBusy(newBusy);
    optimisticRemove(r.key);
    try {
      const body: Record<string, unknown> = { reminderKey: r.key };
      if (kind === "TRATADO") body.action = "TRATADO";
      else if (kind === "DISPENSADO") body.action = "DISPENSADO";
      else {
        body.action = "ADIADO";
        const days = kind === "ADIADO_7" ? 7 : 30;
        body.snoozeUntil = new Date(Date.now() + days * 86400000).toISOString();
      }
      const res = await fetch("/api/reminders/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
    } catch {
      // rollback: recarrega tudo
      reload();
    } finally {
      setBusy((b) => {
        const c = new Set(b);
        c.delete(r.key);
        return c;
      });
    }
  }

  if (loading || !data) return <p className="text-muted-foreground p-8">Carregando alertas...</p>;

  if (data.counts.total === 0) {
    return (
      <div className="rounded-xl bg-card glass-border p-8 text-center text-muted-foreground">
        Nenhum alerta pendente. Volte aqui depois que sincronizar com Clinicorp.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <MiniCard label="Recall" value={data.counts.recall} />
        <MiniCard label="Inativos" value={data.counts.inactive} />
        <MiniCard label="Pos-consulta" value={data.counts.postconsulta} />
      </div>

      {data.overdue.length > 0 && (
        <Section title={`Atrasados (${data.overdue.length})`} reminders={data.overdue} onAction={handleAction} openMenu={openMenu} setOpenMenu={setOpenMenu} busy={busy} />
      )}
      {data.urgent.length > 0 && (
        <Section title={`Urgentes (${data.urgent.length})`} reminders={data.urgent} onAction={handleAction} openMenu={openMenu} setOpenMenu={setOpenMenu} busy={busy} />
      )}
      {data.upcoming.length > 0 && (
        <Section title={`Em breve (${data.upcoming.length})`} reminders={data.upcoming} onAction={handleAction} openMenu={openMenu} setOpenMenu={setOpenMenu} busy={busy} />
      )}
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card glass-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

interface SectionProps {
  title: string;
  reminders: Reminder[];
  onAction: (r: Reminder, kind: ActionKind) => void;
  openMenu: string | null;
  setOpenMenu: (k: string | null) => void;
  busy: Set<string>;
}

function Section({ title, reminders, onAction, openMenu, setOpenMenu, busy }: SectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">{title}</h3>
      <div className="rounded-xl bg-card glass-border divide-y divide-border/50">
        {reminders.map((r) => (
          <div key={r.key} className="flex items-center gap-3 px-4 py-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">{iconFor(r.type)}</span>
            <Link href={`/dashboard/patients/${r.patientId}`} className="flex-1 min-w-0 hover:text-gold">
              <p className="font-medium truncate">{r.patientName}</p>
              <p className="text-xs text-muted-foreground truncate">{r.description}</p>
            </Link>
            <span className="text-xs text-muted-foreground hidden sm:inline">{r.patientPhone ?? "-"}</span>
            <div className="relative">
              <button
                disabled={busy.has(r.key)}
                onClick={() => setOpenMenu(openMenu === r.key ? null : r.key)}
                className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                Tratar
              </button>
              {openMenu === r.key && (
                <div className="absolute right-0 top-full mt-1 z-10 w-44 rounded-md border border-border bg-card shadow-lg">
                  <button onClick={() => onAction(r, "TRATADO")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50">Tratado</button>
                  <button onClick={() => onAction(r, "ADIADO_7")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50">Adiar 7 dias</button>
                  <button onClick={() => onAction(r, "ADIADO_30")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50">Adiar 30 dias</button>
                  <button onClick={() => onAction(r, "DISPENSADO")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50 text-red-600">Dispensar</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

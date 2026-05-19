"use client";

import { useCallback, useEffect, useState } from "react";
import { useReminderActions } from "@/lib/reminders/use-reminder-actions";
import { ReminderRow, type Reminder } from "@/components/dashboard/reminder-row";

interface GroupedData {
  overdue: Reminder[];
  urgent: Reminder[];
  upcoming: Reminder[];
  counts: { recall: number; inactive: number; postconsulta: number; total: number };
}

interface Props {
  onCountChange?: (total: number) => void;
}

export function PatientAlerts({ onCountChange }: Props) {
  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const optimisticRemove = useCallback(
    (key: string) => {
      setData((prev) => {
        if (!prev) return prev;
        const filter = (arr: Reminder[]) => arr.filter((r) => r.key !== key);
        const next: GroupedData = {
          overdue: filter(prev.overdue),
          urgent: filter(prev.urgent),
          upcoming: filter(prev.upcoming),
          counts: { ...prev.counts, total: prev.counts.total - 1 },
        };
        onCountChange?.(next.counts.total);
        return next;
      });
    },
    [onCountChange],
  );

  const { busy, openMenu, setOpenMenu, handleAction } = useReminderActions({
    onActioned: optimisticRemove,
    onError: reload,
  });

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
        <Section
          title={`Atrasados (${data.overdue.length})`}
          reminders={data.overdue}
          busy={busy}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          handleAction={handleAction}
        />
      )}
      {data.urgent.length > 0 && (
        <Section
          title={`Urgentes (${data.urgent.length})`}
          reminders={data.urgent}
          busy={busy}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          handleAction={handleAction}
        />
      )}
      {data.upcoming.length > 0 && (
        <Section
          title={`Em breve (${data.upcoming.length})`}
          reminders={data.upcoming}
          busy={busy}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          handleAction={handleAction}
        />
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
  busy: Set<string>;
  openMenu: string | null;
  setOpenMenu: (k: string | null) => void;
  handleAction: (key: string, kind: import("@/lib/reminders/use-reminder-actions").ActionKind) => Promise<void>;
}

function Section({ title, reminders, busy, openMenu, setOpenMenu, handleAction }: SectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">{title}</h3>
      <div className="rounded-xl bg-card glass-border divide-y divide-border/50">
        {reminders.map((r) => (
          <ReminderRow
            key={r.key}
            reminder={r}
            busy={busy.has(r.key)}
            menuOpen={openMenu === r.key}
            onMenuToggle={() => setOpenMenu(openMenu === r.key ? null : r.key)}
            onAction={(kind) => handleAction(r.key, kind)}
          />
        ))}
      </div>
    </div>
  );
}

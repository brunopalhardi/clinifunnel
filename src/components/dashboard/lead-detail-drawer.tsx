"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useReminderActions } from "@/lib/reminders/use-reminder-actions";
import { ReminderRow, type Reminder } from "@/components/dashboard/reminder-row";

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
}

interface LeadDetail {
  id: string;
  kommoLeadId: string;
  name: string;
  phone: string | null;
  channel: string;
  utmSource: string | null;
  utmCampaign: string | null;
  kommoStatus: string | null;
  statusName: string | null;
  statusColor: string | null;
  kommoCreatedAt: string | null;
  createdAt: string;
  agendamentoAt: string | null;
  kommoSubdomain: string | null;
  patient: {
    id: string;
    createdAt: string;
    procedures: {
      id: string;
      name: string;
      value: number;
      discountAmount: number;
      statusDescription: string | null;
      completedAt: string | null;
      createdAt: string;
    }[];
  } | null;
}

interface RemindersPayload {
  overdue: Reminder[];
  urgent: Reminder[];
  upcoming: Reminder[];
  counts: { total: number };
}

interface TimelineEvent {
  date: string;
  label: string;
  detail?: string;
  link?: { href: string; label: string };
  ok?: boolean;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtFull = (d: string) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function buildTimeline(lead: LeadDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const createdAt = lead.kommoCreatedAt ?? lead.createdAt;
  events.push({ date: createdAt, label: "Lead capturado no Kommo" });
  if (lead.agendamentoAt) {
    events.push({ date: lead.agendamentoAt, label: "Agendado" });
  }
  if (lead.patient) {
    events.push({
      date: lead.patient.createdAt,
      label: "Virou paciente",
      link: {
        href: `/dashboard/patients/${lead.patient.id}`,
        label: "Ver perfil completo",
      },
    });
    for (const proc of lead.patient.procedures) {
      events.push({
        date: proc.completedAt ?? proc.createdAt,
        label: proc.name,
        detail: fmt(proc.value - (proc.discountAmount ?? 0)),
        ok: proc.statusDescription === "Aprovado",
      });
    }
  }
  return events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export function LeadDetailDrawer({ leadId, onClose }: LeadDetailDrawerProps) {
  const [data, setData] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Reminder[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[] | null>(null);

  useEffect(() => {
    if (!leadId) {
      setData(null);
      return;
    }
    setLoading(true);
    setData(null);
    const controller = new AbortController();
    fetch(`/api/leads/${leadId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => setData(json.data ?? null))
      .catch((err) => {
        if (err.name !== "AbortError") setData(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [leadId]);

  useEffect(() => {
    if (!leadId) {
      setAllReminders(null);
      setAlerts([]);
      return;
    }
    const controller = new AbortController();
    fetch("/api/reminders", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        const p: RemindersPayload | undefined = json.data;
        if (!p) {
          setAllReminders([]);
          return;
        }
        setAllReminders([...p.overdue, ...p.urgent, ...p.upcoming]);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setAllReminders([]);
      });
    return () => controller.abort();
  }, [leadId]);

  useEffect(() => {
    if (!data?.patient?.id || allReminders === null) {
      setAlerts([]);
      return;
    }
    const patientId = data.patient.id;
    setAlerts(allReminders.filter((r) => r.patientId === patientId));
  }, [data, allReminders]);

  useEffect(() => {
    if (!leadId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [leadId, onClose]);

  const { busy, openMenu, setOpenMenu, handleAction } = useReminderActions({
    onActioned: (key: string) => setAlerts((prev) => prev.filter((r) => r.key !== key)),
    onError: () => {
      // rollback: refaz fetch
      if (data?.patient?.id) {
        const patientId = data.patient.id;
        fetch("/api/reminders")
          .then((r) => r.json())
          .then((json) => {
            const p: RemindersPayload | undefined = json.data;
            if (!p) return;
            const all = [...p.overdue, ...p.urgent, ...p.upcoming];
            setAlerts(all.filter((r) => r.patientId === patientId));
          })
          .catch(() => {});
      }
    },
  });

  if (!leadId) return null;

  const timeline = data ? buildTimeline(data) : [];
  const kommoUrl =
    data?.kommoSubdomain && data?.kommoLeadId
      ? `https://${data.kommoSubdomain}.kommo.com/leads/detail/${data.kommoLeadId}`
      : null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card shadow-2xl glass-border">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border/30 bg-card px-5 py-4">
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold truncate">
              {loading ? "Carregando..." : data?.name ?? "—"}
            </h2>
            {data?.statusName && (
              <span
                className="inline-flex mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-foreground"
                style={
                  data.statusColor
                    ? { backgroundColor: `${data.statusColor}33`, color: data.statusColor }
                    : undefined
                }
              >
                {data.statusName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            aria-label="Fechar"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="px-5 py-6 text-sm text-muted-foreground">Carregando...</div>
        )}

        {!loading && data && (
          <div className="px-5 py-4 space-y-5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Telefone:</dt>
              <dd>{data.phone ?? "—"}</dd>
              <dt className="text-muted-foreground">Canal:</dt>
              <dd>{data.channel === "campaign" ? "Campanha" : "Orgânico"}</dd>
              {data.utmSource && (
                <>
                  <dt className="text-muted-foreground">UTM Source:</dt>
                  <dd>{data.utmSource}</dd>
                </>
              )}
              {data.utmCampaign && (
                <>
                  <dt className="text-muted-foreground">UTM Campaign:</dt>
                  <dd>{data.utmCampaign}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Criado:</dt>
              <dd>{fmtFull(data.kommoCreatedAt ?? data.createdAt)}</dd>
              {data.agendamentoAt && (
                <>
                  <dt className="text-muted-foreground">Agendado:</dt>
                  <dd>{fmtFull(data.agendamentoAt)}</dd>
                </>
              )}
            </dl>

            {alerts.length > 0 && (
              <div>
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Alertas ativos ({alerts.length})
                </h3>
                <div className="rounded-xl bg-card glass-border divide-y divide-border/50">
                  {alerts.map((r) => (
                    <ReminderRow
                      key={r.key}
                      reminder={r}
                      busy={busy.has(r.key)}
                      menuOpen={openMenu === r.key}
                      onMenuToggle={() => setOpenMenu(openMenu === r.key ? null : r.key)}
                      onAction={(kind) => handleAction(r.key, kind)}
                      hidePatientLink
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Jornada
              </h3>
              <ol className="space-y-3">
                {timeline.map((ev, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          ev.ok === false ? "bg-muted-foreground" : "bg-primary"
                        }`}
                      />
                      {i < timeline.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-xs text-muted-foreground">{fmtFull(ev.date)}</p>
                      <p className="text-sm">
                        {ev.label}
                        {ev.detail && (
                          <span className="ml-2 font-semibold">{ev.detail}</span>
                        )}
                        {ev.ok === true && <span className="ml-2 text-success">✓</span>}
                      </p>
                      {ev.link && (
                        <Link
                          href={ev.link.href}
                          className="text-xs text-primary hover:underline"
                        >
                          {ev.link.label} →
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {kommoUrl && (
              <div className="border-t border-border/30 pt-4">
                <a
                  href={kommoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  Abrir no Kommo
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M7 17 17 7M7 7h10v10" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

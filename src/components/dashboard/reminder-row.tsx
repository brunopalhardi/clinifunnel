"use client";

import Link from "next/link";
import type { ActionKind } from "@/lib/reminders/use-reminder-actions";

export interface Reminder {
  key: string;
  type: "recall" | "inactive" | "postconsulta";
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  procedureName: string | null;
  daysUntilDue: number;
  description: string;
}

function iconFor(t: Reminder["type"]): string {
  if (t === "recall") return "RC";
  if (t === "inactive") return "IN";
  return "PC";
}

interface Props {
  reminder: Reminder;
  busy: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onAction: (kind: ActionKind) => void;
  /** Se true, esconde o link pro perfil do paciente (usado no drawer onde ja estamos vendo o lead). */
  hidePatientLink?: boolean;
}

export function ReminderRow({
  reminder: r,
  busy,
  menuOpen,
  onMenuToggle,
  onAction,
  hidePatientLink,
}: Props) {
  const body = (
    <>
      <p className="font-medium truncate">{r.patientName}</p>
      <p className="text-xs text-muted-foreground truncate">{r.description}</p>
    </>
  );
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
        {iconFor(r.type)}
      </span>
      {hidePatientLink ? (
        <div className="flex-1 min-w-0">{body}</div>
      ) : (
        <Link
          href={`/dashboard/patients/${r.patientId}`}
          className="flex-1 min-w-0 hover:text-gold"
        >
          {body}
        </Link>
      )}
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {r.patientPhone ?? "-"}
      </span>
      <div className="relative">
        <button
          disabled={busy}
          onClick={onMenuToggle}
          className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          Tratar
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-10 w-44 rounded-md border border-border bg-card shadow-lg">
            <button
              onClick={() => onAction("TRATADO")}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
            >
              Tratado
            </button>
            <button
              onClick={() => onAction("ADIADO_7")}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
            >
              Adiar 7 dias
            </button>
            <button
              onClick={() => onAction("ADIADO_30")}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
            >
              Adiar 30 dias
            </button>
            <button
              onClick={() => onAction("DISPENSADO")}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50 text-red-600"
            >
              Dispensar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

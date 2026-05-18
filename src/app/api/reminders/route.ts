import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { computeReminders } from "@/lib/reminders/calc";
import type { ReminderActionRecord, RemindersGrouped } from "@/lib/reminders/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let clinicId: string;
  try {
    const auth = await getAuthorizedClinicId(request);
    clinicId = auth.clinicId;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro de autorizacao" }, { status: 500 });
  }

  const [procRows, recallIntervals, clinic, actionRows] = await Promise.all([
    prisma.procedure.findMany({
      where: {
        clinicId,
        statusDescription: "Aprovado",
        deleted: false,
      },
      select: {
        id: true,
        name: true,
        completedAt: true,
        createdAt: true,
        patient: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.procedureRecallInterval.findMany({
      where: { clinicId },
      select: { procedureNamePattern: true, days: true },
    }),
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { recallInactiveMonths: true, recallPostConsultaDays: true },
    }),
    prisma.reminderAction.findMany({
      where: { clinicId },
      select: { reminderKey: true, action: true, snoozeUntil: true, createdAt: true },
    }),
  ]);

  // [DASH-9.1] Fallback: clinicas que nao preenchem ExecutedDate no Clinicorp tem
  // completedAt=null. Usa createdAt (que vem do estimate.CreateDate via sync — data
  // real de aprovacao do orcamento no Clinicorp).
  const procedures = procRows.map((p) => ({
    id: p.id,
    name: p.name,
    completedAt: p.completedAt ?? p.createdAt,
    patient: p.patient,
  }));

  const actions: ReminderActionRecord[] = actionRows.map((a) => ({
    reminderKey: a.reminderKey,
    action: a.action as ReminderActionRecord["action"],
    snoozeUntil: a.snoozeUntil,
    createdAt: a.createdAt,
  }));

  const reminders = computeReminders({
    procedures,
    recallIntervals,
    inactiveMonths: clinic?.recallInactiveMonths ?? 6,
    postConsultaDays: clinic?.recallPostConsultaDays ?? 3,
    actions,
  });

  reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const grouped: RemindersGrouped = {
    overdue: reminders.filter((r) => r.urgency === "overdue"),
    urgent: reminders.filter((r) => r.urgency === "urgent"),
    upcoming: reminders.filter((r) => r.urgency === "upcoming"),
    counts: {
      recall: reminders.filter((r) => r.type === "recall").length,
      inactive: reminders.filter((r) => r.type === "inactive").length,
      postconsulta: reminders.filter((r) => r.type === "postconsulta").length,
      total: reminders.length,
    },
  };

  return NextResponse.json({ data: grouped });
}

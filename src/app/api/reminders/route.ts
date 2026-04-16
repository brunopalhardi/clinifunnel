import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const PROCEDURE_INTERVALS: Record<string, number> = {
  botox: 120,
  toxina: 120,
  preenchimento: 240,
  filler: 240,
  bioestimulador: 365,
};

function getReturnIntervalDays(procedureName: string): number | null {
  const lower = procedureName.toLowerCase();
  for (const [key, days] of Object.entries(PROCEDURE_INTERVALS)) {
    if (lower.includes(key)) return days;
  }
  return null;
}

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

  const procedures = await prisma.procedure.findMany({
    where: {
      clinicId,
      status: "completed",
      completedAt: { not: null },
    },
    include: {
      patient: {
        select: { id: true, name: true, phone: true, canalProspeccao: true },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  const now = new Date();
  const reminders = [];

  for (const proc of procedures) {
    const intervalDays = getReturnIntervalDays(proc.name);
    if (!intervalDays || !proc.completedAt) continue;

    const dueDate = new Date(proc.completedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue <= 30) {
      reminders.push({
        patientId: proc.patient.id,
        patientName: proc.patient.name,
        phone: proc.patient.phone,
        canal: proc.patient.canalProspeccao,
        procedureName: proc.name,
        lastDate: proc.completedAt,
        dueDate,
        daysUntilDue,
        status: daysUntilDue < 0 ? "overdue" : daysUntilDue <= 7 ? "urgent" : "upcoming",
      });
    }
  }

  reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return NextResponse.json({ data: reminders });
}

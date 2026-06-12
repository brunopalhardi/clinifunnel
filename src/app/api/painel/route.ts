// [DASH-14] /api/painel — KPIs executivos do Painel Principal (call Sérgio 08/06):
// ticket médio por PACIENTE (global / novo / recorrente) e por doutora.
// Métricas em src/lib/metrics/patient-ticket.ts. Por-doutora vem de Procedure
// (dentistName 100% preenchido ali; em Appointment é null — vistoria DASH-12).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { APPROVED_PROCEDURE_FILTER } from "@/lib/dashboard-filters";
import {
  computePatientTicket,
  classifyPatients,
  ticketByDentist,
} from "@/lib/metrics/patient-ticket";

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

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Período de procedures por createdAt (consistente com /api/operacao).
  const procDateFilter = from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  // 1. Procedures aprovados do período, com dentista.
  const procs = await prisma.procedure.findMany({
    where: { clinicId, ...APPROVED_PROCEDURE_FILTER, ...procDateFilter },
    select: { patientId: true, value: true, discountAmount: true, dentistName: true },
  });
  const patientIds = Array.from(new Set(procs.map((p) => p.patientId)));

  // 2 e 3 são independentes entre si (só dependem de patientIds) — rodam em
  // paralelo, como o /api/operacao faz com suas queries.
  const appointmentDateFilter = from || to ? {
    date: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};
  const [appts, historyRows] = await Promise.all([
    // 2. Tags de tipo de consulta desses pacientes no período (classificação).
    patientIds.length
      ? prisma.appointment.findMany({
          where: { clinicId, deleted: false, patientId: { in: patientIds }, ...appointmentDateFilter },
          select: { patientId: true, categoryDescription: true },
        })
      : Promise.resolve([]),
    // 3. Histórico: pacientes do período com procedure Aprovado ANTES do período.
    from && patientIds.length
      ? prisma.procedure.findMany({
          where: { clinicId, ...APPROVED_PROCEDURE_FILTER, patientId: { in: patientIds }, createdAt: { lt: new Date(from) } },
          select: { patientId: true },
          distinct: ["patientId"],
        })
      : Promise.resolve([]),
  ]);
  const categoriesByPatient = new Map<string, string[]>();
  for (const a of appts) {
    if (!a.patientId || !a.categoryDescription) continue;
    const list = categoriesByPatient.get(a.patientId) ?? [];
    list.push(a.categoryDescription);
    categoriesByPatient.set(a.patientId, list);
  }
  const patientsWithHistory = new Set(historyRows.map((r) => r.patientId));

  // 4. Classifica e calcula ticket por paciente.
  const classes = classifyPatients({ patientIds, categoriesByPatient, patientsWithHistory });
  const procsNovo = procs.filter((p) => classes.get(p.patientId) === "novo");
  const procsRecorrente = procs.filter((p) => classes.get(p.patientId) === "recorrente");

  return NextResponse.json({
    data: {
      ticketGlobal: computePatientTicket(procs),
      ticketNovo: computePatientTicket(procsNovo),
      ticketRecorrente: computePatientTicket(procsRecorrente),
      porDoutora: ticketByDentist(procs), // [{dentistName, patients, revenue, ticketMedio}]
    },
  });
}

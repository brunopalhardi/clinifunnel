import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, getAuthorizedClinicId } from "@/lib/auth-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let clinicId: string;
  try {
    ({ clinicId } = await getAuthorizedClinicId(request));
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  // findFirst com clinicId garante que paciente da Clinic A nao seja acessado
  // por user da Clinic B (mesmo conhecendo o id do paciente).
  const patient = await prisma.patient.findFirst({
    where: { id: params.id, clinicId },
    include: {
      leads: {
        select: {
          id: true,
          name: true,
          channel: true,
          canalProspeccao: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          kommoCreatedAt: true,
          agendamentoAt: true,
        },
        orderBy: { kommoCreatedAt: "asc" },
      },
      procedures: {
        select: {
          id: true,
          name: true,
          value: true,
          status: true,
          completedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const firstLead = patient.leads[0] ?? null;
  const totalRevenue = patient.procedures
    .filter((p) => p.status === "completed" || p.status === "approved")
    .reduce((sum, p) => sum + p.value, 0);
  const lastProcedure = patient.procedures.length > 0 ? patient.procedures[0] : null;

  const timeline: { date: string; type: string; description: string }[] = [];

  if (firstLead?.kommoCreatedAt) {
    timeline.push({
      date: firstLead.kommoCreatedAt.toISOString(),
      type: "lead",
      description: `Lead criado (${firstLead.canalProspeccao ?? firstLead.channel})`,
    });
  }
  if (firstLead?.agendamentoAt) {
    timeline.push({
      date: firstLead.agendamentoAt.toISOString(),
      type: "agendamento",
      description: "Consulta agendada",
    });
  }
  for (const proc of patient.procedures) {
    timeline.push({
      date: (proc.completedAt ?? proc.createdAt).toISOString(),
      type: "procedure",
      description: `${proc.name} — R$ ${proc.value.toFixed(2)} (${proc.status})`,
    });
  }
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({
    data: {
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
      cpf: patient.cpf,
      canalProspeccao: patient.canalProspeccao ?? firstLead?.canalProspeccao ?? null,
      utms: {
        source: firstLead?.utmSource,
        medium: firstLead?.utmMedium,
        campaign: firstLead?.utmCampaign,
        content: firstLead?.utmContent,
      },
      totalRevenue,
      procedureCount: patient.procedures.length,
      firstContact: firstLead?.kommoCreatedAt,
      lastProcedure: lastProcedure ? {
        name: lastProcedure.name,
        date: lastProcedure.completedAt ?? lastProcedure.createdAt,
        value: lastProcedure.value,
      } : null,
      procedures: patient.procedures,
      timeline,
      createdAt: patient.createdAt,
    },
  });
}

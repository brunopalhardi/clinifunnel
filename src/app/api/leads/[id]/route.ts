import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

// [DASH-8] Detalhe do lead pra alimentar o LeadDetailDrawer. Multi-tenant:
// findFirst com clinicId obrigatorio. 404 unificado pra nao vazar
// existencia de IDs de outras clinicas.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, clinicId },
    include: {
      patient: {
        include: {
          procedures: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              value: true,
              discountAmount: true,
              statusDescription: true,
              completedAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
  }

  // Enriquece com statusName/Color via Clinic.kommoStages, mesmo padrao de
  // /api/leads (LEAD-2). Se nao tiver cache, retorna ID cru como fallback.
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { kommoStages: true, kommoSubdomain: true },
  });
  const stagesMap = (clinic?.kommoStages ?? {}) as Record<
    string,
    { name: string; color: string; pipelineId: string }
  >;
  const stage = lead.kommoStatus ? stagesMap[lead.kommoStatus] : null;

  return NextResponse.json({
    data: {
      id: lead.id,
      kommoLeadId: lead.kommoLeadId,
      name: lead.name,
      phone: lead.phone,
      channel: lead.channel,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
      utmContent: lead.utmContent,
      kommoStatus: lead.kommoStatus,
      statusName: stage?.name ?? lead.kommoStatus ?? null,
      statusColor: stage?.color ?? null,
      kommoCreatedAt: lead.kommoCreatedAt,
      createdAt: lead.createdAt,
      agendamentoAt: lead.agendamentoAt,
      kommoSubdomain: clinic?.kommoSubdomain ?? null,
      patient: lead.patient
        ? {
            id: lead.patient.id,
            createdAt: lead.patient.createdAt,
            procedures: lead.patient.procedures,
          }
        : null,
    },
  });
}

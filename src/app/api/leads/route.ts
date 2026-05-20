import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { buildLeadDateFilter } from "@/lib/dashboard-filters";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");
  const campaign = searchParams.get("campaign");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

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

  const allPipelines = searchParams.get("allPipelines") === "true";

  const where: Record<string, unknown> = { clinicId };

  // [LEAD-2] Pega tambem o kommoStages cache (map id -> {name, color, pipelineId})
  // pra enriquecer cada lead com statusName humano em vez do ID cru.
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { pipelineId: true, kommoStages: true },
  });

  if (!allPipelines && clinic?.pipelineId) {
    where.kommoPipelineId = clinic.pipelineId;
  }

  if (channel) where.channel = channel;
  if (campaign) where.utmCampaign = campaign;
  // DASH-2: filtra por kommoCreatedAt (fonte de verdade) com fallback pra
  // createdAt em legacy. Espalhamos via OR — junta com os demais filtros via AND.
  const dateFilter = buildLeadDateFilter({ from, to });
  if (dateFilter.OR) {
    where.OR = dateFilter.OR;
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      patient: {
        include: {
          // [DASH-11.fix] Procedures aprovadas (filtradas server-side, so id) pra
          // que /dashboard/captacao consiga distinguir "fecharam" sem fazer
          // request extra. Sem isso, lead.patient.procedures fica undefined e
          // .some()/.length crasham o componente client-side.
          procedures: {
            where: { statusDescription: "Aprovado", deleted: false },
            select: { id: true },
          },
        },
      },
    },
    // Ordena por kommoCreatedAt (data de criacao no Kommo) com fallback —
    // mais util que createdAt do nosso DB pra leitura humana.
    orderBy: [
      { kommoCreatedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 100,
  });

  // [LEAD-2] Enriquece com statusName + statusColor traduzindo kommoStatus (ID)
  // via Clinic.kommoStages. Se nao tiver cache, retorna ID cru como fallback.
  const stagesMap = (clinic?.kommoStages ?? {}) as Record<
    string,
    { name: string; color: string; pipelineId: string }
  >;
  const enriched = leads.map((lead) => {
    const stage = lead.kommoStatus ? stagesMap[lead.kommoStatus] : null;
    return {
      ...lead,
      statusName: stage?.name ?? lead.kommoStatus ?? null,
      statusColor: stage?.color ?? null,
    };
  });

  return NextResponse.json({ data: enriched });
}

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
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
  // [DASH-11.activity] Modo "leads com movimentacao no periodo" usado pelo
  // /dashboard/captacao. Quando true, o WHERE vira OR: capturado no range OU
  // agendamentoAt no range OU patient com procedure aprovada no range. As
  // procedures incluidas tambem ficam pre-filtradas ao range. Sem o flag, o
  // endpoint mantem o comportamento atual (so leads capturados no range) —
  // usado por /dashboard/leads.
  const withRangeActivity = searchParams.get("withRangeActivity") === "true";

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
  const hasRange = !!(from || to);
  const procedureRangeFilter: Prisma.ProcedureWhereInput = hasRange
    ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      }
    : {};

  if (withRangeActivity && hasRange) {
    // Movimentacao no periodo = capturado, agendado, OU paciente com procedure
    // aprovada no range. Une as 3 condicoes via OR pra trazer toda atividade.
    const orConditions: Prisma.LeadWhereInput[] = [];
    if (dateFilter.OR) {
      orConditions.push(...(dateFilter.OR as Prisma.LeadWhereInput[]));
    }
    orConditions.push({
      agendamentoAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    });
    orConditions.push({
      patient: {
        procedures: {
          some: {
            statusDescription: "Aprovado",
            deleted: false,
            ...procedureRangeFilter,
          },
        },
      },
    });
    where.OR = orConditions;
  } else if (dateFilter.OR) {
    where.OR = dateFilter.OR;
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      patient: {
        include: {
          // [DASH-11.fix] Procedures aprovadas (so id). Quando withRangeActivity,
          // tambem filtra ao range — assim o client conta "fechou no periodo" via
          // procedures.length > 0 e bate com o KPI "Procedimentos fechados".
          procedures: {
            where: {
              statusDescription: "Aprovado",
              deleted: false,
              ...(withRangeActivity ? procedureRangeFilter : {}),
            },
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

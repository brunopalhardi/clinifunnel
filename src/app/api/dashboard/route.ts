import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { buildLeadDateFilter } from "@/lib/dashboard-filters";

export const dynamic = "force-dynamic";

function formatBucketLabel(bucket: Date, granularity: "day" | "week" | "month"): string {
  const d = new Date(bucket);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  if (granularity === "month") {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
  }
  if (granularity === "week") {
    return `${day}/${month}`;
  }
  return `${day}/${month}`;
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

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const patientType = searchParams.get("patientType"); // "new" | "returning" | null

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { pipelineId: true },
  });

  const pipelineFilter = clinic?.pipelineId
    ? { kommoPipelineId: clinic.pipelineId }
    : {};

  const patientTypeFilter = patientType === "new"
    ? { isNewPatient: true }
    : patientType === "returning"
      ? { isNewPatient: false }
      : {};

  // DASH-2: filtro de data dos LEADS usa kommoCreatedAt (fonte de verdade do
  // Kommo) com fallback pra createdAt em legacy. Antes usava createdAt direto
  // (DB insert), o que inflava contagens — leads antigos do Kommo que mudavam
  // de stage hoje viravam "novos" no nosso DB porque webhook so dispara em
  // mudanca, e createdAt @default(now()) sempre marca a primeira insercao.
  const dateFilter = buildLeadDateFilter({ from, to });

  const procedureDateFilter = from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  const adDateFilter = from || to ? {
    date: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  // Filter: only procedures whose patient has at least one lead (came through funnel)
  const funnelProcedureFilter = {
    clinicId,
    status: { in: ["completed", "approved"] },
    patient: { leads: { some: { ...pipelineFilter, ...patientTypeFilter } } },
    ...procedureDateFilter,
  };

  const leadWhere = { clinicId, ...pipelineFilter, ...patientTypeFilter, ...dateFilter };

  // DASH-1: 3 buckets de origem da receita.
  // Captacao: pacientes com lead no pipelineId atual (= mesmo dataset do "Receita do funil").
  // Recorrentes: pacientes com lead em outros pipelines, sem nenhum lead no principal.
  // Walk-ins: pacientes sem lead nenhum.
  // OBS: NAO usa patientTypeFilter porque "novo vs existente" eh ortogonal a "captacao
  // vs recorrente vs walk-in" (clinica AD usa pipelines distintos pra cada caso).
  const procedureBaseStatus = { in: ["completed", "approved"] };

  const captacaoWhere = clinic?.pipelineId
    ? {
        clinicId,
        status: procedureBaseStatus,
        patient: { leads: { some: { kommoPipelineId: clinic.pipelineId } } },
        ...procedureDateFilter,
      }
    : null;

  const recorrentesWhere = clinic?.pipelineId
    ? {
        clinicId,
        status: procedureBaseStatus,
        AND: [
          { patient: { leads: { some: { kommoPipelineId: { not: clinic.pipelineId } } } } },
          { patient: { leads: { none: { kommoPipelineId: clinic.pipelineId } } } },
        ],
        ...procedureDateFilter,
      }
    : null;

  const walkInWhere = {
    clinicId,
    status: procedureBaseStatus,
    patient: { leads: { none: {} } },
    ...procedureDateFilter,
  };

  const emptyAgg = { _count: { id: 0 }, _sum: { value: 0 } };

  const [
    totalLeads,
    campaignLeads,
    agendamentos,
    compareceram,
    procedureAgg,
    totalProcedureAgg,
    adSpendAgg,
    topProcedures,
    canalBreakdown,
    captacaoAgg,
    recorrentesAgg,
    walkInAgg,
  ] = await Promise.all([
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.count({ where: { ...leadWhere, channel: "campaign" } }),
    prisma.lead.count({ where: { ...leadWhere, agendamentoAt: { not: null } } }),
    // Compareceram: leads com paciente vinculado E paciente tem >= 1 procedimento
    prisma.lead.count({
      where: {
        ...leadWhere,
        patientId: { not: null },
        patient: { procedures: { some: {} } },
      },
    }),
    // Procedures DO FUNIL (apenas pacientes vinculados a leads)
    prisma.procedure.aggregate({
      where: funnelProcedureFilter,
      _count: { id: true },
      _sum: { value: true },
    }),
    // Procedures TOTAIS da clinica (independente de funil)
    prisma.procedure.aggregate({
      where: {
        clinicId,
        status: procedureBaseStatus,
        ...procedureDateFilter,
      },
      _count: { id: true },
      _sum: { value: true },
    }),
    prisma.adCampaignData.aggregate({
      where: { clinicId, ...adDateFilter },
      _sum: { spend: true, impressions: true, clicks: true },
    }),
    // Top 3 procedures by revenue (only funnel-linked)
    prisma.procedure.groupBy({
      by: ["name"],
      where: funnelProcedureFilter,
      _sum: { value: true },
      _count: { id: true },
      orderBy: { _sum: { value: "desc" } },
      take: 3,
    }),
    // Canal de prospeccao breakdown
    prisma.lead.groupBy({
      by: ["canalProspeccao"],
      where: { ...leadWhere, canalProspeccao: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    captacaoWhere
      ? prisma.procedure.aggregate({ where: captacaoWhere, _count: { id: true }, _sum: { value: true } })
      : Promise.resolve(emptyAgg),
    recorrentesWhere
      ? prisma.procedure.aggregate({ where: recorrentesWhere, _count: { id: true }, _sum: { value: true } })
      : Promise.resolve(emptyAgg),
    prisma.procedure.aggregate({ where: walkInWhere, _count: { id: true }, _sum: { value: true } }),
  ]);

  // Decidir granularity (dia/semana/mes) baseado no range
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const rangeDays = fromDate && toDate
    ? Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    : 30;
  const granularity: "day" | "week" | "month" =
    rangeDays <= 31 ? "day" : rangeDays <= 90 ? "week" : "month";
  const truncFn = granularity === "day" ? "day" : granularity === "week" ? "week" : "month";

  // Revenue timeline (only funnel-linked procedures)
  const dateParams: string[] = [clinicId];
  let leadSubquery = `SELECT 1 FROM "Lead" l WHERE l."patientId" = pt.id`;
  if (clinic?.pipelineId) {
    dateParams.push(clinic.pipelineId);
    leadSubquery += ` AND l."kommoPipelineId" = $${dateParams.length}`;
  }
  if (patientType === "new") {
    leadSubquery += ` AND l."isNewPatient" = true`;
  } else if (patientType === "returning") {
    leadSubquery += ` AND l."isNewPatient" = false`;
  }
  // Agrupa pela data REAL do procedimento: completedAt quando existe (data de execucao
  // vinda do Clinicorp), com fallback pra createdAt. createdAt vem de Estimate.CreateDate
  // do Clinicorp, que e a data de criacao do orcamento e nao a data do atendimento — usar
  // so ele empilhava todos os procedimentos no dia em que o sync rodou.
  const procDateExpr = `COALESCE(p."completedAt", p."createdAt")`;
  let dateConditions = ` AND EXISTS (${leadSubquery})`;
  if (from) {
    dateParams.push(from);
    dateConditions += ` AND ${procDateExpr} >= $${dateParams.length}::timestamp`;
  }
  if (to) {
    dateParams.push(to);
    dateConditions += ` AND ${procDateExpr} <= $${dateParams.length}::timestamp`;
  }

  const revenueTimeline = await prisma.$queryRawUnsafe<Array<{ bucket: Date; total: number }>>(
    `SELECT date_trunc('${truncFn}', ${procDateExpr}) as bucket, SUM(p.value)::float as total
     FROM "Procedure" p
     INNER JOIN "Patient" pt ON p."patientId" = pt.id
     WHERE p."clinicId" = $1
       AND p.status IN ('completed', 'approved')
       ${dateConditions}
     GROUP BY bucket ORDER BY bucket ASC`,
    ...dateParams
  );

  const organicLeads = totalLeads - campaignLeads;
  const procedimentos = procedureAgg._count.id;
  const totalRevenue = procedureAgg._sum.value ?? 0;
  const procedimentosClinica = totalProcedureAgg._count.id;
  const receitaClinica = totalProcedureAgg._sum.value ?? 0;
  const totalSpend = adSpendAgg._sum.spend ?? 0;
  const cpl = campaignLeads > 0 && totalSpend > 0 ? totalSpend / campaignLeads : null;

  // Revenue chart: timeline (dia / semana / mes)
  const revenueChart = revenueTimeline.map((r) => ({
    day: formatBucketLabel(r.bucket, granularity),
    iso: new Date(r.bucket).toISOString(),
    value: Number(r.total),
  }));

  // Top procedures formatted
  const topProcs = topProcedures.map((p) => ({
    name: p.name,
    count: p._count.id,
    revenue: p._sum.value ?? 0,
    ticketMedio: p._count.id > 0 ? (p._sum.value ?? 0) / p._count.id : 0,
  }));

  // Performance by channel (meta ads data)
  const adsByPlatform = await prisma.adCampaignData.groupBy({
    by: ["platform"],
    where: { clinicId, ...adDateFilter },
    _sum: { spend: true, impressions: true, clicks: true },
  });

  const channelPerformance = adsByPlatform.map((ch) => ({
    channel: ch.platform === "meta" ? "Meta Ads" : ch.platform === "google" ? "Google Ads" : ch.platform,
    spend: ch._sum.spend ?? 0,
    impressions: ch._sum.impressions ?? 0,
    clicks: ch._sum.clicks ?? 0,
  }));

  // Add organic channel
  if (organicLeads > 0) {
    channelPerformance.push({
      channel: "Organico",
      spend: 0,
      impressions: 0,
      clicks: 0,
    });
  }

  // DASH-1: composicao da receita
  const captacaoRevenue = captacaoAgg._sum.value ?? 0;
  const recorrentesRevenue = recorrentesAgg._sum.value ?? 0;
  const walkInRevenue = walkInAgg._sum.value ?? 0;
  const totalOrigem = captacaoRevenue + recorrentesRevenue + walkInRevenue;
  const pct = (v: number) => (totalOrigem > 0 ? (v / totalOrigem) * 100 : 0);

  const receitaPorOrigem = {
    captacao: {
      count: captacaoAgg._count.id,
      revenue: captacaoRevenue,
      percent: pct(captacaoRevenue),
    },
    recorrentes: {
      count: recorrentesAgg._count.id,
      revenue: recorrentesRevenue,
      percent: pct(recorrentesRevenue),
    },
    walkIn: {
      count: walkInAgg._count.id,
      revenue: walkInRevenue,
      percent: pct(walkInRevenue),
    },
    total: {
      count: captacaoAgg._count.id + recorrentesAgg._count.id + walkInAgg._count.id,
      revenue: totalOrigem,
    },
  };

  return NextResponse.json({
    data: {
      totalLeads,
      campaignLeads,
      organicLeads,
      agendamentos,
      compareceram,
      procedimentos,
      totalRevenue,
      procedimentosClinica,
      receitaClinica,
      totalSpend,
      cpl,
      conversionRate: totalLeads > 0 ? (agendamentos / totalLeads) * 100 : 0,
      revenueChart,
      revenueGranularity: granularity,
      topProcedures: topProcs,
      channelPerformance,
      receitaPorOrigem,
      canalBreakdown: canalBreakdown.map((c) => ({
        canal: c.canalProspeccao ?? "Nao identificado",
        count: c._count.id,
      })),
    },
  });
}

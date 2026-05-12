import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { APPROVED_PROCEDURE_FILTER, buildLeadDateFilter } from "@/lib/dashboard-filters";

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

  // [DASH-4] Filtro de data dos appointments (usa Appointment.date, que vem do
  // campo `date` do Clinicorp = data marcada da consulta). Nao filtra por
  // pipeline/patientType — appointments sao da clinica inteira.
  const appointmentDateFilter = from || to ? {
    date: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  // [DASH-3] Filtro base de receita: procs Aprovado (status nivel-procedure,
  // vem do Clinicorp) e nao-deletado. value liquido = value - discountAmount.
  // Antes filtravamos por status legado in ["completed", "approved"], que vinha
  // do est.Status (granularidade errada — incluia procs "Orçamento" dentro de
  // estimates APPROVED).
  const funnelProcedureFilter = {
    clinicId,
    ...APPROVED_PROCEDURE_FILTER,
    patient: { leads: { some: { ...pipelineFilter, ...patientTypeFilter } } },
    ...procedureDateFilter,
  };

  const leadWhere = { clinicId, ...pipelineFilter, ...patientTypeFilter, ...dateFilter };

  // DASH-1: 3 buckets de origem da receita.
  // Captacao: pacientes com lead no pipelineId atual (= mesmo dataset do "Receita do funil").
  // Recorrentes: pacientes com lead em outros pipelines, sem nenhum lead no principal.
  // Walk-ins: pacientes sem lead nenhum.
  const captacaoWhere = clinic?.pipelineId
    ? {
        clinicId,
        ...APPROVED_PROCEDURE_FILTER,
        patient: { leads: { some: { kommoPipelineId: clinic.pipelineId } } },
        ...procedureDateFilter,
      }
    : null;

  const recorrentesWhere = clinic?.pipelineId
    ? {
        clinicId,
        ...APPROVED_PROCEDURE_FILTER,
        AND: [
          { patient: { leads: { some: { kommoPipelineId: { not: clinic.pipelineId } } } } },
          { patient: { leads: { none: { kommoPipelineId: clinic.pipelineId } } } },
        ],
        ...procedureDateFilter,
      }
    : null;

  const walkInWhere = {
    clinicId,
    ...APPROVED_PROCEDURE_FILTER,
    patient: { leads: { none: {} } },
    ...procedureDateFilter,
  };

  const emptyAgg = { _count: { id: 0 }, _sum: { value: 0, discountAmount: 0 } };

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
    appointmentsByStatus,
  ] = await Promise.all([
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.count({ where: { ...leadWhere, channel: "campaign" } }),
    prisma.lead.count({ where: { ...leadWhere, agendamentoAt: { not: null } } }),
    // [DASH-4.1] Compareceram = leads com paciente que tem appointment "Atendido"
    // no Clinicorp (mesma fonte do KPI "Comparecimento" da linha 2, pra evitar
    // discrepancia entre os 2 lugares onde aparece). Antes contava lead.patient.procedures
    // — calculo legado que dependia do patientId estar populado, e contava qualquer
    // procedure (aprovado ou nao). Agora usa Appointment como fonte da verdade.
    prisma.lead.count({
      where: {
        ...leadWhere,
        patient: {
          appointments: { some: { statusKey: "atendido", deleted: false } },
        },
      },
    }),
    // Procedures DO FUNIL (apenas pacientes vinculados a leads) — soma bruta + desconto
    prisma.procedure.aggregate({
      where: funnelProcedureFilter,
      _count: { id: true },
      _sum: { value: true, discountAmount: true },
    }),
    // Procedures TOTAIS da clinica (independente de funil)
    prisma.procedure.aggregate({
      where: {
        clinicId,
        ...APPROVED_PROCEDURE_FILTER,
        ...procedureDateFilter,
      },
      _count: { id: true },
      _sum: { value: true, discountAmount: true },
    }),
    prisma.adCampaignData.aggregate({
      where: { clinicId, ...adDateFilter },
      _sum: { spend: true, impressions: true, clicks: true },
    }),
    // Top 3 procedures by revenue (only funnel-linked)
    prisma.procedure.groupBy({
      by: ["name"],
      where: funnelProcedureFilter,
      _sum: { value: true, discountAmount: true },
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
      ? prisma.procedure.aggregate({ where: captacaoWhere, _count: { id: true }, _sum: { value: true, discountAmount: true } })
      : Promise.resolve(emptyAgg),
    recorrentesWhere
      ? prisma.procedure.aggregate({ where: recorrentesWhere, _count: { id: true }, _sum: { value: true, discountAmount: true } })
      : Promise.resolve(emptyAgg),
    prisma.procedure.aggregate({ where: walkInWhere, _count: { id: true }, _sum: { value: true, discountAmount: true } }),
    // [DASH-4] Appointments por statusKey no range, FILTRADOS PELO FUNIL DE CAPTACAO.
    // Significado: dos leads captados no Kommo (no pipelineId configurado), quantos
    // de fato compareceram (atendido), confirmaram, faltaram, etc no Clinicorp.
    // Patient_PersonId do appointment cai no nosso Patient.id; filtramos por
    // pacientes que tem ao menos 1 lead no pipeline de captacao (e respeita
    // patientType pra coerencia com o resto da Visao Geral).
    prisma.appointment.groupBy({
      by: ["statusKey"],
      where: {
        clinicId,
        deleted: false,
        ...appointmentDateFilter,
        patient: {
          leads: {
            some: { ...pipelineFilter, ...patientTypeFilter },
          },
        },
      },
      _count: { id: true },
    }),
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

  // [DASH-3] Filtra agora por statusDescription='Aprovado' + deleted=false em vez
  // do legacy status IN ('completed','approved'). E soma value LIQUIDO (- discountAmount).
  const revenueTimeline = await prisma.$queryRawUnsafe<Array<{ bucket: Date; total: number }>>(
    `SELECT date_trunc('${truncFn}', ${procDateExpr}) as bucket,
            SUM(p.value - p."discountAmount")::float as total
     FROM "Procedure" p
     INNER JOIN "Patient" pt ON p."patientId" = pt.id
     WHERE p."clinicId" = $1
       AND p."statusDescription" = 'Aprovado'
       AND p."deleted" = false
       ${dateConditions}
     GROUP BY bucket ORDER BY bucket ASC`,
    ...dateParams
  );

  const organicLeads = totalLeads - campaignLeads;
  const procedimentos = procedureAgg._count.id;
  // [DASH-3] Receita liquida: bruto - desconto rateado entre aprovados.
  const totalRevenue = (procedureAgg._sum.value ?? 0) - (procedureAgg._sum.discountAmount ?? 0);
  const procedimentosClinica = totalProcedureAgg._count.id;
  const receitaClinica = (totalProcedureAgg._sum.value ?? 0) - (totalProcedureAgg._sum.discountAmount ?? 0);
  const totalSpend = adSpendAgg._sum.spend ?? 0;
  const cpl = campaignLeads > 0 && totalSpend > 0 ? totalSpend / campaignLeads : null;

  // Revenue chart: timeline (dia / semana / mes)
  const revenueChart = revenueTimeline.map((r) => ({
    day: formatBucketLabel(r.bucket, granularity),
    iso: new Date(r.bucket).toISOString(),
    value: Number(r.total),
  }));

  // Top procedures formatted — usa receita liquida
  const topProcs = topProcedures.map((p) => ({
    name: p.name,
    count: p._count.id,
    revenue: (p._sum.value ?? 0) - (p._sum.discountAmount ?? 0),
    ticketMedio:
      p._count.id > 0
        ? ((p._sum.value ?? 0) - (p._sum.discountAmount ?? 0)) / p._count.id
        : 0,
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

  // DASH-1: composicao da receita (DASH-3: receita liquida = value - discountAmount)
  const captacaoRevenue = (captacaoAgg._sum.value ?? 0) - (captacaoAgg._sum.discountAmount ?? 0);
  const recorrentesRevenue = (recorrentesAgg._sum.value ?? 0) - (recorrentesAgg._sum.discountAmount ?? 0);
  const walkInRevenue = (walkInAgg._sum.value ?? 0) - (walkInAgg._sum.discountAmount ?? 0);
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

  // [DASH-4] Consolida appointments por statusKey num objeto facil de consumir.
  const consultasByStatus = appointmentsByStatus.reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.statusKey] = row._count.id;
      return acc;
    },
    {},
  );
  const consultas = {
    realizadas: consultasByStatus.atendido ?? 0,
    confirmadas: consultasByStatus.confirmado ?? 0,
    faltaram: consultasByStatus.faltou ?? 0,
    agendadas: consultasByStatus.agendado ?? 0,
    emEspera: consultasByStatus.em_espera ?? 0,
    emAtendimento: consultasByStatus.em_atendimento ?? 0,
    atrasadas: consultasByStatus.atrasado ?? 0,
    total: appointmentsByStatus.reduce((a, r) => a + r._count.id, 0),
  };

  return NextResponse.json({
    data: {
      totalLeads,
      campaignLeads,
      organicLeads,
      // [DASH-4] `agendamentos` = leads marcados como agendados no Kommo
      // (Lead.agendamentoAt != null). Renomeado na UI pra "Consultas marcadas".
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
      // [DASH-4] consultas vindas do Clinicorp (status real do appointment),
      // filtradas pelos LEADS DO FUNIL (pacientes com lead no pipeline configurado).
      consultas,
      canalBreakdown: canalBreakdown.map((c) => ({
        canal: c.canalProspeccao ?? "Nao identificado",
        count: c._count.id,
      })),
    },
  });
}

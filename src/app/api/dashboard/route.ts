import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinicId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!clinicId) {
    return NextResponse.json({ error: "clinicId is required" }, { status: 400 });
  }

  const dateFilter = from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

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
    patient: { leads: { some: {} } },
    ...procedureDateFilter,
  };

  const [
    totalLeads,
    campaignLeads,
    agendamentos,
    compareceram,
    procedureAgg,
    adSpendAgg,
    topProcedures,
  ] = await Promise.all([
    prisma.lead.count({ where: { clinicId, ...dateFilter } }),
    prisma.lead.count({ where: { clinicId, channel: "campaign", ...dateFilter } }),
    prisma.lead.count({ where: { clinicId, agendamentoAt: { not: null }, ...dateFilter } }),
    // Compareceram: leads com paciente vinculado E paciente tem >= 1 procedimento
    prisma.lead.count({
      where: {
        clinicId,
        patientId: { not: null },
        patient: { procedures: { some: {} } },
        ...dateFilter,
      },
    }),
    prisma.procedure.aggregate({
      where: funnelProcedureFilter,
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
  ]);

  // Revenue by day of week (only funnel-linked procedures)
  const dateParams: string[] = [clinicId];
  let dateConditions = "";
  if (from) {
    dateParams.push(from);
    dateConditions += ` AND p."createdAt" >= $${dateParams.length}::timestamp`;
  }
  if (to) {
    dateParams.push(to);
    dateConditions += ` AND p."createdAt" <= $${dateParams.length}::timestamp`;
  }

  const revenueByDay = await prisma.$queryRawUnsafe<Array<{ day: number; total: number }>>(
    `SELECT EXTRACT(DOW FROM p."createdAt") as day, SUM(p.value) as total
     FROM "Procedure" p
     INNER JOIN "Patient" pt ON p."patientId" = pt.id
     WHERE p."clinicId" = $1
       AND p.status IN ('completed', 'approved')
       AND EXISTS (SELECT 1 FROM "Lead" l WHERE l."patientId" = pt.id)
       ${dateConditions}
     GROUP BY day ORDER BY day`,
    ...dateParams
  );

  const organicLeads = totalLeads - campaignLeads;
  const procedimentos = procedureAgg._count.id;
  const totalRevenue = procedureAgg._sum.value ?? 0;
  const totalSpend = adSpendAgg._sum.spend ?? 0;
  const cpl = campaignLeads > 0 && totalSpend > 0 ? totalSpend / campaignLeads : null;

  // Revenue by day of week
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const revenueChart = dayNames.map((name, i) => {
    const found = revenueByDay.find((r) => Number(r.day) === i);
    return { day: name, value: found ? Number(found.total) : 0 };
  });

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

  return NextResponse.json({
    data: {
      totalLeads,
      campaignLeads,
      organicLeads,
      agendamentos,
      compareceram,
      procedimentos,
      totalRevenue,
      totalSpend,
      cpl,
      conversionRate: totalLeads > 0 ? (agendamentos / totalLeads) * 100 : 0,
      revenueChart,
      topProcedures: topProcs,
      channelPerformance,
    },
  });
}

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

  const adDateFilter = from || to ? {
    date: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  const [
    totalLeads,
    campaignLeads,
    agendamentos,
    procedureAgg,
    adSpendAgg,
    topProcedures,
    revenueByDay,
  ] = await Promise.all([
    prisma.lead.count({ where: { clinicId, ...dateFilter } }),
    prisma.lead.count({ where: { clinicId, channel: "campaign", ...dateFilter } }),
    prisma.lead.count({ where: { clinicId, agendamentoAt: { not: null }, ...dateFilter } }),
    prisma.procedure.aggregate({
      where: {
        clinicId,
        status: { in: ["completed", "approved"] },
        ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      },
      _count: { id: true },
      _sum: { value: true },
    }),
    prisma.adCampaignData.aggregate({
      where: { clinicId, ...adDateFilter },
      _sum: { spend: true, impressions: true, clicks: true },
    }),
    // Top 3 procedures by revenue
    prisma.procedure.groupBy({
      by: ["name"],
      where: {
        clinicId,
        status: { in: ["completed", "approved"] },
        ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      },
      _sum: { value: true },
      _count: { id: true },
      orderBy: { _sum: { value: "desc" } },
      take: 3,
    }),
    // Revenue by day of week
    prisma.$queryRawUnsafe<Array<{ day: number; total: number }>>(
      `SELECT EXTRACT(DOW FROM "createdAt") as day, SUM(value) as total
       FROM "Procedure"
       WHERE "clinicId" = $1 AND status IN ('completed', 'approved')
       ${from ? `AND "createdAt" >= '${from}'` : ""}
       ${to ? `AND "createdAt" <= '${to}'` : ""}
       GROUP BY day ORDER BY day`,
      clinicId
    ),
  ]);

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

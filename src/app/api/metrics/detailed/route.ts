import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinicId");
  const days = parseInt(searchParams.get("days") ?? "30", 10);

  if (!clinicId) {
    return NextResponse.json({ error: "clinicId is required" }, { status: 400 });
  }

  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevFrom = new Date(from.getTime() - days * 24 * 60 * 60 * 1000);

  const dateFilter = { gte: from, lte: now };
  const prevDateFilter = { gte: prevFrom, lte: from };

  // --- Current period ---
  const [totalLeads, campaignLeads, agendamentos, procedureAgg] =
    await Promise.all([
      prisma.lead.count({ where: { clinicId, createdAt: dateFilter } }),
      prisma.lead.count({ where: { clinicId, channel: "campaign", createdAt: dateFilter } }),
      prisma.lead.count({ where: { clinicId, agendamentoAt: { not: null }, createdAt: dateFilter } }),
      prisma.procedure.aggregate({
        where: { clinicId, status: { in: ["completed", "approved"] }, createdAt: dateFilter },
        _count: { id: true },
        _sum: { value: true },
      }),
    ]);

  // --- Previous period ---
  const [prevLeads, prevAgendamentos, prevProcedureAgg] = await Promise.all([
    prisma.lead.count({ where: { clinicId, createdAt: prevDateFilter } }),
    prisma.lead.count({ where: { clinicId, agendamentoAt: { not: null }, createdAt: prevDateFilter } }),
    prisma.procedure.aggregate({
      where: { clinicId, status: { in: ["completed", "approved"] }, createdAt: prevDateFilter },
      _count: { id: true },
      _sum: { value: true },
    }),
  ]);

  const procedimentos = procedureAgg._count.id;
  const totalRevenue = procedureAgg._sum.value ?? 0;
  const prevProcedimentos = prevProcedureAgg._count.id;
  const prevRevenue = prevProcedureAgg._sum.value ?? 0;

  function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 100);
  }

  // --- Revenue by day of week ---
  const procedures = await prisma.procedure.findMany({
    where: { clinicId, status: { in: ["completed", "approved"] }, createdAt: dateFilter },
    select: { value: true, createdAt: true },
  });

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const revenueByDay = dayNames.map((name) => ({ name, value: 0 }));
  for (const p of procedures) {
    const day = new Date(p.createdAt).getDay();
    revenueByDay[day].value += p.value;
  }

  // --- Top procedures ---
  const procGroups = await prisma.procedure.groupBy({
    by: ["name"],
    where: { clinicId, status: { in: ["completed", "approved"] }, createdAt: dateFilter },
    _count: { id: true },
    _sum: { value: true },
  });

  // Previous period for trend
  const prevProcGroups = await prisma.procedure.groupBy({
    by: ["name"],
    where: { clinicId, status: { in: ["completed", "approved"] }, createdAt: prevDateFilter },
    _sum: { value: true },
  });
  const prevProcMap = new Map(prevProcGroups.map((g) => [g.name, g._sum.value ?? 0]));

  const topProcedures = procGroups
    .map((g) => {
      const revenue = g._sum.value ?? 0;
      const prevRev = prevProcMap.get(g.name) ?? 0;
      return {
        name: g.name,
        count: g._count.id,
        revenue,
        ticketMedio: g._count.id > 0 ? revenue / g._count.id : 0,
        trend: pctChange(revenue, prevRev),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // --- Performance by channel (utm_source) ---
  const channelLeads = await prisma.lead.groupBy({
    by: ["utmSource"],
    where: { clinicId, channel: "campaign", createdAt: dateFilter },
    _count: { id: true },
  });

  const channelPerformance = await Promise.all(
    channelLeads
      .filter((c) => c.utmSource)
      .map(async (group) => {
        const leadsWithProcs = await prisma.lead.findMany({
          where: { clinicId, utmSource: group.utmSource, createdAt: dateFilter },
          select: {
            agendamentoAt: true,
            patient: {
              select: {
                procedures: {
                  where: { status: { in: ["completed", "approved"] } },
                  select: { value: true },
                },
              },
            },
          },
        });

        let revenue = 0;
        let conversions = 0;
        for (const l of leadsWithProcs) {
          if (l.agendamentoAt) conversions++;
          if (l.patient) {
            for (const proc of l.patient.procedures) {
              revenue += proc.value;
            }
          }
        }

        return {
          source: group.utmSource ?? "unknown",
          leads: group._count.id,
          conversions,
          conversionRate: group._count.id > 0 ? (conversions / group._count.id) * 100 : 0,
          revenue,
        };
      })
  );

  channelPerformance.sort((a, b) => b.revenue - a.revenue);

  // --- Leads by channel for organic ---
  const organicLeads = totalLeads - campaignLeads;

  return NextResponse.json({
    data: {
      // KPIs
      totalLeads,
      campaignLeads,
      organicLeads,
      agendamentos,
      procedimentos,
      totalRevenue,
      // Comparativo
      leadsChange: pctChange(totalLeads, prevLeads),
      agendamentosChange: pctChange(agendamentos, prevAgendamentos),
      procedimentosChange: pctChange(procedimentos, prevProcedimentos),
      revenueChange: pctChange(totalRevenue, prevRevenue),
      // Conversão
      taxaLeadConsulta: totalLeads > 0 ? (agendamentos / totalLeads) * 100 : 0,
      taxaConsultaFechamento: agendamentos > 0 ? (procedimentos / agendamentos) * 100 : 0,
      taxaLeadFechamento: totalLeads > 0 ? (procedimentos / totalLeads) * 100 : 0,
      // Gráficos
      revenueByDay,
      topProcedures,
      channelPerformance,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinicId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!clinicId) {
    return NextResponse.json(
      { error: "clinicId is required" },
      { status: 400 }
    );
  }

  const dateFilter =
    from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {};

  const [totalLeads, campaignLeads, agendamentos, procedureAgg] =
    await Promise.all([
      prisma.lead.count({
        where: { clinicId, ...dateFilter },
      }),
      prisma.lead.count({
        where: { clinicId, channel: "campaign", ...dateFilter },
      }),
      prisma.lead.count({
        where: {
          clinicId,
          agendamentoAt: { not: null },
          ...dateFilter,
        },
      }),
      prisma.procedure.aggregate({
        where: {
          clinicId,
          status: { in: ["completed", "approved"] },
          ...(from || to
            ? {
                createdAt: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              }
            : {}),
        },
        _count: { id: true },
        _sum: { value: true },
      }),
    ]);

  const organicLeads = totalLeads - campaignLeads;
  const procedimentos = procedureAgg._count.id;
  const totalRevenue = procedureAgg._sum.value ?? 0;
  const conversionRate =
    totalLeads > 0 ? (agendamentos / totalLeads) * 100 : 0;

  return NextResponse.json({
    data: {
      totalLeads,
      campaignLeads,
      organicLeads,
      agendamentos,
      procedimentos,
      totalRevenue,
      conversionRate,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
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

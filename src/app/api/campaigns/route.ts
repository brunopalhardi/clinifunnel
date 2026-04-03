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

  // Get campaign metrics grouped by utmCampaign
  const leads = await prisma.lead.groupBy({
    by: ["utmCampaign"],
    where: {
      clinicId,
      channel: "campaign",
      utmCampaign: { not: null },
      ...dateFilter,
    },
    _count: { id: true },
  });

  // Get procedure data per campaign
  const campaigns = await Promise.all(
    leads.map(async (group) => {
      const campaignLeads = await prisma.lead.findMany({
        where: {
          clinicId,
          utmCampaign: group.utmCampaign,
          ...dateFilter,
        },
        select: {
          id: true,
          agendamentoAt: true,
          patient: {
            select: {
              procedures: {
                select: { value: true, status: true },
              },
            },
          },
        },
      });

      const agendamentos = campaignLeads.filter(
        (l) => l.agendamentoAt
      ).length;

      let procedimentos = 0;
      let revenue = 0;
      for (const lead of campaignLeads) {
        if (lead.patient) {
          for (const proc of lead.patient.procedures) {
            if (
              proc.status === "completed" ||
              proc.status === "approved"
            ) {
              procedimentos++;
              revenue += proc.value;
            }
          }
        }
      }

      return {
        campaign: group.utmCampaign || "unknown",
        leads: group._count.id,
        agendamentos,
        procedimentos,
        revenue,
      };
    })
  );

  return NextResponse.json({ data: campaigns });
}

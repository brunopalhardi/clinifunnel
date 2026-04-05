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

  // Get ad spend data aggregated by campaign name
  const adDateFilter =
    from || to
      ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {};

  const adData = await prisma.adCampaignData.groupBy({
    by: ["campaignName", "platform"],
    where: { clinicId, ...adDateFilter },
    _sum: {
      spend: true,
      impressions: true,
      clicks: true,
    },
  });

  // Indexar ad data por campaign name (case-insensitive)
  const adIndex = new Map<
    string,
    { spend: number; impressions: number; clicks: number; platform: string }
  >();
  for (const ad of adData) {
    const key = ad.campaignName.toLowerCase();
    const existing = adIndex.get(key);
    if (existing) {
      existing.spend += ad._sum.spend || 0;
      existing.impressions += ad._sum.impressions || 0;
      existing.clicks += ad._sum.clicks || 0;
      existing.platform = "both";
    } else {
      adIndex.set(key, {
        spend: ad._sum.spend || 0,
        impressions: ad._sum.impressions || 0,
        clicks: ad._sum.clicks || 0,
        platform: ad.platform,
      });
    }
  }

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

      const campaignName = group.utmCampaign || "unknown";
      const leadCount = group._count.id;

      // Match com ad data (case-insensitive)
      const ad = adIndex.get(campaignName.toLowerCase());

      const spend = ad?.spend || 0;
      const impressions = ad?.impressions || 0;
      const clicks = ad?.clicks || 0;
      const costPerLead = leadCount > 0 && spend > 0 ? spend / leadCount : null;
      const costPerClick = clicks > 0 && spend > 0 ? spend / clicks : null;
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : null;

      return {
        campaign: campaignName,
        leads: leadCount,
        agendamentos,
        procedimentos,
        revenue,
        spend,
        impressions,
        clicks,
        costPerLead,
        costPerClick,
        roi,
        platform: ad?.platform || null,
      };
    })
  );

  // Totais agregados
  const totals = campaigns.reduce(
    (acc, c) => ({
      leads: acc.leads + c.leads,
      agendamentos: acc.agendamentos + c.agendamentos,
      procedimentos: acc.procedimentos + c.procedimentos,
      revenue: acc.revenue + c.revenue,
      spend: acc.spend + c.spend,
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
    }),
    { leads: 0, agendamentos: 0, procedimentos: 0, revenue: 0, spend: 0, impressions: 0, clicks: 0 }
  );

  const totalRoi =
    totals.spend > 0
      ? ((totals.revenue - totals.spend) / totals.spend) * 100
      : null;
  const avgCpl =
    totals.leads > 0 && totals.spend > 0 ? totals.spend / totals.leads : null;

  return NextResponse.json({
    data: campaigns,
    totals: { ...totals, roi: totalRoi, avgCpl },
  });
}

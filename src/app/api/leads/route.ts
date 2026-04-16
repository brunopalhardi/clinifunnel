import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");
  const campaign = searchParams.get("campaign");
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

  const where: Record<string, unknown> = { clinicId };

  if (channel) where.channel = channel;
  if (campaign) where.utmCampaign = campaign;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { patient: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: leads });
}

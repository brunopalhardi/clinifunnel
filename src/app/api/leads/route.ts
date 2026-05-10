import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { buildLeadDateFilter } from "@/lib/dashboard-filters";

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

  const allPipelines = searchParams.get("allPipelines") === "true";

  const where: Record<string, unknown> = { clinicId };

  if (!allPipelines) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { pipelineId: true },
    });
    if (clinic?.pipelineId) {
      where.kommoPipelineId = clinic.pipelineId;
    }
  }

  if (channel) where.channel = channel;
  if (campaign) where.utmCampaign = campaign;
  // DASH-2: filtra por kommoCreatedAt (fonte de verdade) com fallback pra
  // createdAt em legacy. Espalhamos via OR — junta com os demais filtros via AND.
  const dateFilter = buildLeadDateFilter({ from, to });
  if (dateFilter.OR) {
    where.OR = dateFilter.OR;
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { patient: true },
    // Ordena por kommoCreatedAt (data de criacao no Kommo) com fallback —
    // mais util que createdAt do nosso DB pra leitura humana.
    orderBy: [
      { kommoCreatedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 100,
  });

  return NextResponse.json({ data: leads });
}

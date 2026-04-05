import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdsStatusResponse } from "@/lib/ads/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinicId");

  if (!clinicId) {
    return NextResponse.json({ error: "clinicId is required" }, { status: 400 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: {
      metaAccessToken: true,
      metaAdAccountId: true,
      metaTokenExpiresAt: true,
      googleAdsRefreshToken: true,
      googleAdsCustomerId: true,
    },
  });

  if (!clinic) {
    return NextResponse.json({ error: "Clinica nao encontrada" }, { status: 404 });
  }

  // Buscar último sync de cada plataforma
  const [metaLastSync, googleLastSync] = await Promise.all([
    prisma.adCampaignData.findFirst({
      where: { clinicId, platform: "meta" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.adCampaignData.findFirst({
      where: { clinicId, platform: "google" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const status: AdsStatusResponse = {
    meta: {
      connected: !!clinic.metaAccessToken,
      accountId: clinic.metaAdAccountId || undefined,
      tokenExpiresAt: clinic.metaTokenExpiresAt?.toISOString(),
      lastSync: metaLastSync?.updatedAt.toISOString(),
    },
    google: {
      connected: !!clinic.googleAdsRefreshToken,
      accountId: clinic.googleAdsCustomerId || undefined,
      lastSync: googleLastSync?.updatedAt.toISOString(),
    },
  };

  return NextResponse.json({ data: status });
}

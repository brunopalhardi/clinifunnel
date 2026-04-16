import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdsStatusResponse } from "@/lib/ads/types";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

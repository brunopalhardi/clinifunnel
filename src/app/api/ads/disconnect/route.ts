import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdPlatform } from "@/lib/ads/types";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const { platform } = body as { platform: AdPlatform };

  if (!platform || (platform !== "meta" && platform !== "google")) {
    return NextResponse.json({ error: "platform must be 'meta' or 'google'" }, { status: 400 });
  }

  const data =
    platform === "meta"
      ? { metaAccessToken: null, metaTokenExpiresAt: null, metaAdAccountId: null }
      : { googleAdsRefreshToken: null, googleAdsCustomerId: null };

  await prisma.clinic.update({ where: { id: clinicId }, data });

  return NextResponse.json({ success: true });
}

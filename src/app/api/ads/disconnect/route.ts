import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdPlatform } from "@/lib/ads/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { clinicId, platform } = body as { clinicId: string; platform: AdPlatform };

  if (!clinicId || !platform) {
    return NextResponse.json(
      { error: "clinicId and platform are required" },
      { status: 400 }
    );
  }

  if (platform !== "meta" && platform !== "google") {
    return NextResponse.json(
      { error: "platform must be 'meta' or 'google'" },
      { status: 400 }
    );
  }

  const data =
    platform === "meta"
      ? { metaAccessToken: null, metaTokenExpiresAt: null, metaAdAccountId: null }
      : { googleAdsRefreshToken: null, googleAdsCustomerId: null };

  await prisma.clinic.update({
    where: { id: clinicId },
    data,
  });

  return NextResponse.json({ success: true });
}

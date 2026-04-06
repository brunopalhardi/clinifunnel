import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/ads/oauth";
import { GoogleAdsClient } from "@/lib/ads/google-ads-client";

/**
 * GET /api/auth/google-ads/callback
 * Callback do Google OAuth. Troca code por refresh token e salva no Clinic.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?google=denied", process.env.NEXTAUTH_URL || request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?google=error", process.env.NEXTAUTH_URL || request.url)
    );
  }

  const clinicId = verifyOAuthState(state);
  if (!clinicId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?google=invalid_state", process.env.NEXTAUTH_URL || request.url)
    );
  }

  try {
    const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin;
    const redirectUri = `${origin}/api/auth/google-ads/callback`;

    // Trocar code por tokens
    const { refreshToken, accessToken } =
      await GoogleAdsClient.exchangeCodeForTokens(code, redirectUri);

    // Buscar customer IDs acessíveis
    const customerIds = await GoogleAdsClient.listAccessibleCustomers(accessToken);

    if (customerIds.length === 0) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?google=no_accounts", process.env.NEXTAUTH_URL || request.url)
      );
    }

    // Usar primeiro customer ID (MVP)
    const customerId = customerIds[0];

    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        googleAdsRefreshToken: refreshToken,
        googleAdsCustomerId: customerId,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard/settings?google=success", process.env.NEXTAUTH_URL || request.url)
    );
  } catch (err) {
    console.error("[google-ads-callback] Error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?google=error", process.env.NEXTAUTH_URL || request.url)
    );
  }
}

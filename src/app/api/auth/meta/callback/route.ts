import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/ads/oauth";
import { MetaAdsClient } from "@/lib/ads/meta-client";

/**
 * GET /api/auth/meta/callback
 * Callback do Facebook OAuth. Troca code por long-lived token e salva no Clinic.
 * Não é protegido por middleware (redirect externo do Facebook).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Usuário negou permissão
  if (error) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?meta=denied", request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?meta=error", request.url)
    );
  }

  // Verificar CSRF via state
  const clinicId = verifyOAuthState(state);
  if (!clinicId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?meta=invalid_state", request.url)
    );
  }

  try {
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/auth/meta/callback`;

    // Trocar code por long-lived token
    const { accessToken, expiresIn } = await MetaAdsClient.exchangeCodeForToken(
      code,
      redirectUri
    );

    // Buscar ad accounts disponíveis
    const client = new MetaAdsClient(accessToken, "");
    const adAccounts = await client.getAdAccounts();

    if (adAccounts.length === 0) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?meta=no_accounts", request.url)
      );
    }

    // Usar primeira ad account (MVP)
    const adAccountId = adAccounts[0].id;

    // Salvar tokens no banco
    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        metaAccessToken: accessToken,
        metaTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        metaAdAccountId: adAccountId,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard/settings?meta=success", request.url)
    );
  } catch (err) {
    console.error("[meta-callback] Error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?meta=error", request.url)
    );
  }
}

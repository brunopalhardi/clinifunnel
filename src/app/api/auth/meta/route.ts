import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateOAuthState } from "@/lib/ads/oauth";

/**
 * GET /api/auth/meta?clinicId=xxx
 * Redireciona o usuário para o Facebook OAuth consent screen.
 * Scope: ads_read (somente leitura de dados de anúncios).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clinicId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const clinicId = session.user.clinicId;
  const appId = process.env.META_APP_ID;

  if (!appId) {
    return NextResponse.json(
      { error: "META_APP_ID não configurado" },
      { status: 500 }
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/meta/callback`;
  const state = generateOAuthState(clinicId);

  const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  // ads_read: somente leitura — compliance Meta para dados de saúde
  authUrl.searchParams.set("scope", "ads_read");
  authUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authUrl.toString());
}

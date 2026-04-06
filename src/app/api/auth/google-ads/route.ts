import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateOAuthState } from "@/lib/ads/oauth";

/**
 * GET /api/auth/google-ads
 * Redireciona o usuário para o Google OAuth consent screen.
 * Scope: adwords (somente leitura de dados de anúncios).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clinicId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const clinicId = session.user.clinicId;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID não configurado" },
      { status: 500 }
    );
  }

  const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/google-ads/callback`;
  const state = generateOAuthState(clinicId);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline"); // garante refresh token
  authUrl.searchParams.set("prompt", "consent"); // força re-consent pra garantir refresh token

  return NextResponse.redirect(authUrl.toString());
}

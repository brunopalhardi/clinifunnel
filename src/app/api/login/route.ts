import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha obrigatorios" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { clinic: { select: { id: true, name: true } } },
  });

  if (!user) {
    return NextResponse.json({ error: "Email ou senha invalidos" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Email ou senha invalidos" }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  // Generate NextAuth-compatible JWT token
  const token = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      clinicName: user.clinic.name,
    },
    secret,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // Detect if request came via HTTPS (Cloudflare/proxy)
  const isSecure =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.url.startsWith("https");

  const cookieName = isSecure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  const response = NextResponse.json({ ok: true, user: { name: user.name, email: user.email } });

  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}

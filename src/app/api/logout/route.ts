import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // Clear all possible session cookie names
  for (const name of [
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
    "__Host-next-auth.csrf-token",
    "next-auth.csrf-token",
    "__Secure-next-auth.callback-url",
    "next-auth.callback-url",
  ]) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }

  return response;
}

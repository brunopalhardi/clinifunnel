import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  changeOwnPassword,
  InvalidCredentialsError,
  WeakPasswordError,
} from "@/lib/users";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = logger.child({ scope: "api-change-password" });

interface Body {
  currentPassword?: string;
  newPassword?: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  const body = (await request.json()) as Body;
  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json(
      { error: "currentPassword e newPassword sao obrigatorios" },
      { status: 400 },
    );
  }

  try {
    await changeOwnPassword(
      session.user.id,
      body.currentPassword,
      body.newPassword,
    );
    log.info({ userId: session.user.id }, "password changed");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WeakPasswordError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof InvalidCredentialsError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    log.error({ err, userId: session.user.id }, "failed to change password");
    return NextResponse.json(
      { error: "Falha ao trocar senha" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resetUserPasswordToTemp } from "@/lib/users";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = logger.child({ scope: "api-users-reset-pw" });

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  const isAdmin =
    session.user.role === "super_admin" || session.user.role === "clinic_admin";
  if (!isAdmin) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const { id } = await params;
  // Carrega target user pra validar tenant e nao revelar existencia cross-tenant.
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, clinicId: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  // clinic_admin so reseta usuarios da propria clinica e nao reseta outros admins/super_admin.
  if (session.user.role === "clinic_admin") {
    if (target.clinicId !== session.user.clinicId) {
      return NextResponse.json({ error: "Usuario de outra clinica" }, { status: 403 });
    }
    if (target.role === "super_admin" || target.role === "clinic_admin") {
      return NextResponse.json(
        { error: "clinic_admin nao pode resetar senha de outro admin" },
        { status: 403 },
      );
    }
  }
  // super_admin pode resetar qualquer um exceto outro super_admin via API.
  if (session.user.role === "super_admin" && target.role === "super_admin") {
    return NextResponse.json(
      { error: "Reset de senha de super_admin nao permitido via API" },
      { status: 403 },
    );
  }
  // Self-reset: bloquear (use change-password com senha atual em vez disso).
  if (target.id === session.user.id) {
    return NextResponse.json(
      { error: "Use /api/auth/change-password para trocar a propria senha" },
      { status: 400 },
    );
  }

  try {
    const result = await resetUserPasswordToTemp(id);
    log.info(
      { resetBy: session.user.id, userId: id },
      "user password reset",
    );
    return NextResponse.json({ data: result });
  } catch (err) {
    log.error({ err, userId: id }, "failed to reset password");
    return NextResponse.json({ error: "Falha ao resetar" }, { status: 500 });
  }
}

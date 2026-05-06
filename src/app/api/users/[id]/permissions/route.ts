import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ACTIONS,
  Action,
  Module,
  MODULES,
  Permissions,
} from "@/lib/permissions";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = logger.child({ scope: "api-users-perms" });

// Sanitiza permissions vindo do client. Aceita so modulos e actions canonicos.
function sanitize(raw: unknown): Permissions | null {
  if (raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Permissions = {};
  const obj = raw as Record<string, unknown>;
  for (const m of MODULES) {
    const v = obj[m];
    if (Array.isArray(v)) {
      const filtered = v.filter((x): x is Action =>
        typeof x === "string" && ACTIONS.includes(x as Action),
      );
      if (filtered.length > 0) out[m as Module] = filtered;
    }
  }
  return out;
}

export async function PUT(
  request: NextRequest,
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
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, clinicId: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  // clinic_admin so edita usuarios da propria clinica e nao edita admins.
  if (session.user.role === "clinic_admin") {
    if (target.clinicId !== session.user.clinicId) {
      return NextResponse.json({ error: "Outra clinica" }, { status: 403 });
    }
    if (target.role !== "user") {
      return NextResponse.json(
        { error: "clinic_admin so edita permissions de role=user" },
        { status: 403 },
      );
    }
  }
  // Ninguem edita permissions de super_admin via API (super_admin sempre pode tudo).
  if (target.role === "super_admin") {
    return NextResponse.json(
      { error: "super_admin nao tem permissions editaveis" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const sanitized = sanitize(body.permissions);
  // body.permissions === null -> remove (volta a baseline do role)
  // body.permissions object -> aplica
  const valueToStore =
    body.permissions === null ? null : sanitized ?? null;

  await prisma.user.update({
    where: { id },
    data: { permissions: valueToStore as never },
  });

  log.info(
    { editedBy: session.user.id, userId: id, hasPermissions: valueToStore !== null },
    "user permissions updated",
  );

  return NextResponse.json({ ok: true, permissions: valueToStore });
}

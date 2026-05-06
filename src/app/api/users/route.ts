import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUserWithTempPassword } from "@/lib/users";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = logger.child({ scope: "api-users" });

// Apenas super_admin e clinic_admin podem listar/criar users.
function isAdmin(role: string): boolean {
  return role === "super_admin" || role === "clinic_admin";
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  // super_admin lista todos (com filtro opcional por ?clinicId=); demais so a propria clinica.
  const { searchParams } = new URL(request.url);
  const requestedClinicId = searchParams.get("clinicId");
  let clinicFilter: string | undefined;

  if (session.user.role === "super_admin") {
    clinicFilter = requestedClinicId ?? undefined;
  } else {
    clinicFilter = session.user.clinicId;
    if (requestedClinicId && requestedClinicId !== session.user.clinicId) {
      return NextResponse.json(
        { error: "Sem permissao para esta clinica" },
        { status: 403 },
      );
    }
  }

  const users = await prisma.user.findMany({
    where: clinicFilter ? { clinicId: clinicFilter } : undefined,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clinicId: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
      // permissions e Json — devolve como esta. Sera usado em PR seguinte.
      permissions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: users });
}

interface CreateBody {
  email?: string;
  name?: string;
  role?: string;
  clinicId?: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const body = (await request.json()) as CreateBody;
  if (!body.email || !body.name) {
    return NextResponse.json(
      { error: "email e name sao obrigatorios" },
      { status: 400 },
    );
  }

  // clinicId: super_admin pode especificar qualquer; demais sao forcados na propria.
  let targetClinicId: string;
  if (session.user.role === "super_admin") {
    targetClinicId = body.clinicId ?? session.user.clinicId;
  } else {
    if (body.clinicId && body.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { error: "Sem permissao para criar usuario em outra clinica" },
        { status: 403 },
      );
    }
    targetClinicId = session.user.clinicId;
  }

  // Role: clinic_admin so pode criar "user". super_admin pode criar qualquer um exceto super_admin via API.
  const requestedRole = body.role ?? "user";
  if (session.user.role === "clinic_admin" && requestedRole !== "user") {
    return NextResponse.json(
      { error: "clinic_admin so pode criar role=user" },
      { status: 403 },
    );
  }
  if (requestedRole === "super_admin") {
    return NextResponse.json(
      { error: "Criacao de super_admin nao permitida via API" },
      { status: 403 },
    );
  }

  // Verifica colisao de email antes (Prisma daria P2002 mas mensagem de erro e ruim).
  const existing = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase().trim() },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Ja existe usuario com esse email" },
      { status: 409 },
    );
  }

  try {
    const result = await createUserWithTempPassword({
      email: body.email,
      name: body.name,
      clinicId: targetClinicId,
      role: requestedRole,
    });
    log.info(
      {
        createdBy: session.user.id,
        userId: result.id,
        clinicId: result.clinicId,
        role: result.role,
      },
      "user created",
    );
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    log.error({ err }, "failed to create user");
    return NextResponse.json(
      { error: "Falha ao criar usuario" },
      { status: 500 },
    );
  }
}

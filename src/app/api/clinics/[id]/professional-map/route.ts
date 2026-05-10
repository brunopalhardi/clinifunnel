import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseProfessionalMap,
  toEntries,
  validateProfessionalMapInput,
} from "@/lib/clinicorp/professional-map";
import { PermissionDeniedError, requirePermission } from "@/lib/permissions";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = logger.child({ scope: "api/clinics/professional-map" });

async function authorize(id: string): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin" && id !== session.user.clinicId) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin" && id !== session.user.clinicId) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  try {
    requirePermission(session.user, "settings", "read");
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id },
    select: { professionalMap: true },
  });

  if (!clinic) {
    return NextResponse.json({ error: "Clinica nao encontrada" }, { status: 404 });
  }

  const map = parseProfessionalMap(clinic.professionalMap);
  return NextResponse.json({ data: { entries: toEntries(map) } });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const authError = await authorize(id);
  if (authError) return authError;

  const session = await getServerSession(authOptions);
  try {
    if (session?.user) requirePermission(session.user, "settings", "write");
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const entries = (body as { entries?: unknown })?.entries;
  const validated = validateProfessionalMapInput(entries);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const clinic = await prisma.clinic.findUnique({ where: { id } });
  if (!clinic) {
    return NextResponse.json({ error: "Clinica nao encontrada" }, { status: 404 });
  }

  await prisma.clinic.update({
    where: { id },
    data: { professionalMap: validated.map },
  });

  log.info(
    { clinicId: id, userId: session?.user?.id, entries: Object.keys(validated.map).length },
    "professional map updated",
  );

  return NextResponse.json({ data: { entries: toEntries(validated.map) } });
}

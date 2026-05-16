import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

async function resolveClinicId(request: NextRequest): Promise<string | NextResponse> {
  try {
    const auth = await getAuthorizedClinicId(request);
    return auth.clinicId;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro de autorizacao" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const clinicIdOrErr = await resolveClinicId(request);
  if (typeof clinicIdOrErr !== "string") return clinicIdOrErr;
  const clinicId = clinicIdOrErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const data: { procedureNamePattern?: string; days?: number } = {};

  if (b.procedureNamePattern !== undefined) {
    const pattern = typeof b.procedureNamePattern === "string" ? b.procedureNamePattern.trim() : "";
    if (pattern.length < 2 || pattern.length > 100) {
      return NextResponse.json({ error: "procedureNamePattern deve ter 2-100 chars" }, { status: 400 });
    }
    data.procedureNamePattern = pattern;
  }
  if (b.days !== undefined) {
    const days = typeof b.days === "number" ? Math.floor(b.days) : NaN;
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return NextResponse.json({ error: "days deve ser inteiro entre 1 e 3650" }, { status: 400 });
    }
    data.days = days;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const existing = await prisma.procedureRecallInterval.findFirst({
    where: { id: params.id, clinicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  if (data.procedureNamePattern) {
    const dup = await prisma.procedureRecallInterval.findFirst({
      where: {
        clinicId,
        procedureNamePattern: { equals: data.procedureNamePattern, mode: "insensitive" },
        NOT: { id: params.id },
      },
    });
    if (dup) {
      return NextResponse.json({ error: "Pattern ja existe para esta clinica" }, { status: 409 });
    }
  }

  const updated = await prisma.procedureRecallInterval.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const clinicIdOrErr = await resolveClinicId(request);
  if (typeof clinicIdOrErr !== "string") return clinicIdOrErr;
  const clinicId = clinicIdOrErr;

  const existing = await prisma.procedureRecallInterval.findFirst({
    where: { id: params.id, clinicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  await prisma.procedureRecallInterval.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

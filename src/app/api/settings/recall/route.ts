import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let clinicId: string;
  try {
    const auth = await getAuthorizedClinicId(request);
    clinicId = auth.clinicId;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro de autorizacao" }, { status: 500 });
  }

  const [intervals, clinic] = await Promise.all([
    prisma.procedureRecallInterval.findMany({
      where: { clinicId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { recallInactiveMonths: true, recallPostConsultaDays: true },
    }),
  ]);

  return NextResponse.json({
    data: {
      intervals,
      inactiveMonths: clinic?.recallInactiveMonths ?? 6,
      postConsultaDays: clinic?.recallPostConsultaDays ?? 3,
    },
  });
}

export async function POST(request: NextRequest) {
  let clinicId: string;
  try {
    const auth = await getAuthorizedClinicId(request);
    clinicId = auth.clinicId;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro de autorizacao" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const pattern = typeof b.procedureNamePattern === "string" ? b.procedureNamePattern.trim() : "";
  const days = typeof b.days === "number" ? Math.floor(b.days) : NaN;

  if (pattern.length < 2 || pattern.length > 100) {
    return NextResponse.json({ error: "procedureNamePattern deve ter 2-100 chars" }, { status: 400 });
  }
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    return NextResponse.json({ error: "days deve ser inteiro entre 1 e 3650" }, { status: 400 });
  }

  const existing = await prisma.procedureRecallInterval.findFirst({
    where: { clinicId, procedureNamePattern: { equals: pattern, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Pattern ja existe para esta clinica" }, { status: 409 });
  }

  const created = await prisma.procedureRecallInterval.create({
    data: { clinicId, procedureNamePattern: pattern, days },
  });
  return NextResponse.json({ data: created });
}

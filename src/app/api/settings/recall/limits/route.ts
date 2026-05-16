import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
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
  const data: { recallInactiveMonths?: number; recallPostConsultaDays?: number } = {};

  if (b.inactiveMonths !== undefined) {
    const m = typeof b.inactiveMonths === "number" ? Math.floor(b.inactiveMonths) : NaN;
    if (!Number.isFinite(m) || m < 1 || m > 60) {
      return NextResponse.json({ error: "inactiveMonths deve ser inteiro entre 1 e 60" }, { status: 400 });
    }
    data.recallInactiveMonths = m;
  }
  if (b.postConsultaDays !== undefined) {
    const d = typeof b.postConsultaDays === "number" ? Math.floor(b.postConsultaDays) : NaN;
    if (!Number.isFinite(d) || d < 1 || d > 30) {
      return NextResponse.json({ error: "postConsultaDays deve ser inteiro entre 1 e 30" }, { status: 400 });
    }
    data.recallPostConsultaDays = d;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  await prisma.clinic.update({ where: { id: clinicId }, data });
  return NextResponse.json({ ok: true });
}

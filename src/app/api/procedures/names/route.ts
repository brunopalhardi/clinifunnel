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

  const grouped = await prisma.procedure.groupBy({
    by: ["name"],
    where: { clinicId, statusDescription: "Aprovado", deleted: false },
    _count: { name: true },
    orderBy: { _count: { name: "desc" } },
  });

  const names = grouped.map((g) => ({ name: g.name, count: g._count.name }));
  return NextResponse.json({ data: names });
}

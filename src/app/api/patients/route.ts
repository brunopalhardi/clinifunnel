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

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const canal = searchParams.get("canal");

  const where: Record<string, unknown> = { clinicId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }
  if (canal) {
    where.canalProspeccao = canal;
  }

  const patients = await prisma.patient.findMany({
    where,
    include: {
      leads: {
        select: {
          canalProspeccao: true,
          channel: true,
          kommoCreatedAt: true,
        },
        take: 1,
        orderBy: { kommoCreatedAt: "asc" },
      },
      procedures: {
        where: { status: { in: ["completed", "approved"] } },
        select: { value: true, createdAt: true },
      },
      _count: { select: { procedures: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const data = patients.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    canal: p.canalProspeccao ?? p.leads[0]?.canalProspeccao ?? "—",
    totalRevenue: p.procedures.reduce((sum, proc) => sum + proc.value, 0),
    procedureCount: p._count.procedures,
    firstContact: p.leads[0]?.kommoCreatedAt ?? p.createdAt,
    lastProcedure: p.procedures.length > 0
      ? p.procedures.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
      : null,
  }));

  return NextResponse.json({ data });
}

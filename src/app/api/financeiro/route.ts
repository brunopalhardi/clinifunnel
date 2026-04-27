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
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter = from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  const procFilter = {
    clinicId,
    status: { in: ["completed", "approved"] },
    ...dateFilter,
  };

  const [
    revenueAgg,
    pendingAgg,
    cancelledAgg,
    activePatients,
    topProcedures,
    procedureBreakdown,
  ] = await Promise.all([
    // Receita confirmada (completed + approved)
    prisma.procedure.aggregate({
      where: procFilter,
      _count: { id: true },
      _sum: { value: true },
    }),
    // Pipeline pendente
    prisma.procedure.aggregate({
      where: { clinicId, status: "pending", ...dateFilter },
      _count: { id: true },
      _sum: { value: true },
    }),
    // Canceladas
    prisma.procedure.aggregate({
      where: { clinicId, status: "cancelled", ...dateFilter },
      _count: { id: true },
      _sum: { value: true },
    }),
    // Pacientes ativos no período (com pelo menos 1 procedure no range)
    prisma.procedure.findMany({
      where: procFilter,
      select: { patientId: true },
      distinct: ["patientId"],
    }),
    // Top procedimentos por receita
    prisma.procedure.groupBy({
      by: ["name"],
      where: procFilter,
      _sum: { value: true },
      _count: { id: true },
      orderBy: { _sum: { value: "desc" } },
      take: 10,
    }),
    // Breakdown por status (todos os procedures no período)
    prisma.procedure.groupBy({
      by: ["status"],
      where: { clinicId, ...dateFilter },
      _sum: { value: true },
      _count: { id: true },
    }),
  ]);

  // Receita por dia (últimos 30 dias se sem filtro, ou range)
  const revenueByDay = await prisma.$queryRawUnsafe<Array<{ day: string; total: number; count: number }>>(
    `SELECT
       DATE("createdAt") as day,
       SUM(value)::float as total,
       COUNT(*)::int as count
     FROM "Procedure"
     WHERE "clinicId" = $1
       AND status IN ('completed', 'approved')
       ${from ? `AND "createdAt" >= $2::timestamp` : ""}
       ${to ? `AND "createdAt" <= $${from ? "3" : "2"}::timestamp` : ""}
     GROUP BY DATE("createdAt")
     ORDER BY day DESC
     LIMIT 60`,
    clinicId,
    ...(from ? [from] : []),
    ...(to ? [to] : [])
  );

  const totalRevenue = revenueAgg._sum.value ?? 0;
  const totalProcedures = revenueAgg._count.id;
  const ticketMedio = totalProcedures > 0 ? totalRevenue / totalProcedures : 0;

  return NextResponse.json({
    data: {
      // KPIs principais
      totalRevenue,
      totalProcedures,
      ticketMedio,
      activePatients: activePatients.length,
      pendingRevenue: pendingAgg._sum.value ?? 0,
      pendingCount: pendingAgg._count.id,
      cancelledRevenue: cancelledAgg._sum.value ?? 0,
      cancelledCount: cancelledAgg._count.id,
      // Detalhes
      topProcedures: topProcedures.map((p) => ({
        name: p.name,
        count: p._count.id,
        revenue: p._sum.value ?? 0,
        ticketMedio: p._count.id > 0 ? (p._sum.value ?? 0) / p._count.id : 0,
      })),
      procedureBreakdown: procedureBreakdown.map((s) => ({
        status: s.status,
        count: s._count.id,
        revenue: s._sum.value ?? 0,
      })),
      revenueByDay: revenueByDay.reverse().map((r) => ({
        day: r.day,
        revenue: Number(r.total),
        count: Number(r.count),
      })),
    },
  });
}

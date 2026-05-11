import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { APPROVED_PROCEDURE_FILTER } from "@/lib/dashboard-filters";

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

  // [DASH-3] Receita confirmada = procs statusDescription='Aprovado', deleted=false.
  // Pendente e Cancelada continuam por statusDescription tambem ("Orçamento", "Cancelado").
  // Valor liquido em todas as somas (value - discountAmount).
  const procFilter = {
    clinicId,
    ...APPROVED_PROCEDURE_FILTER,
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
    // Receita confirmada (Aprovado)
    prisma.procedure.aggregate({
      where: procFilter,
      _count: { id: true },
      _sum: { value: true, discountAmount: true },
    }),
    // Pipeline pendente: procs com status "Orçamento" (orcamentos abertos)
    prisma.procedure.aggregate({
      where: { clinicId, statusDescription: "Orçamento", deleted: false, ...dateFilter },
      _count: { id: true },
      _sum: { value: true, discountAmount: true },
    }),
    // Canceladas
    prisma.procedure.aggregate({
      where: { clinicId, statusDescription: "Cancelado", deleted: false, ...dateFilter },
      _count: { id: true },
      _sum: { value: true, discountAmount: true },
    }),
    // Pacientes ativos no período
    prisma.procedure.findMany({
      where: procFilter,
      select: { patientId: true },
      distinct: ["patientId"],
    }),
    // Top procedimentos por receita liquida
    prisma.procedure.groupBy({
      by: ["name"],
      where: procFilter,
      _sum: { value: true, discountAmount: true },
      _count: { id: true },
      orderBy: { _sum: { value: "desc" } },
      take: 10,
    }),
    // Breakdown por statusDescription (granularidade certa)
    prisma.procedure.groupBy({
      by: ["statusDescription"],
      where: { clinicId, deleted: false, ...dateFilter },
      _sum: { value: true, discountAmount: true },
      _count: { id: true },
    }),
  ]);

  // Receita por dia (últimos 30 dias se sem filtro, ou range).
  // Agrupa por completedAt quando existe (data real de execucao vinda do Clinicorp),
  // com fallback pra createdAt. Mesmo motivo do timeline da Visao Geral.
  const procDateExpr = `COALESCE("completedAt", "createdAt")`;
  const revenueByDay = await prisma.$queryRawUnsafe<Array<{ day: string; total: number; count: number }>>(
    `SELECT
       DATE(${procDateExpr}) as day,
       SUM(value - "discountAmount")::float as total,
       COUNT(*)::int as count
     FROM "Procedure"
     WHERE "clinicId" = $1
       AND "statusDescription" = 'Aprovado'
       AND "deleted" = false
       ${from ? `AND ${procDateExpr} >= $2::timestamp` : ""}
       ${to ? `AND ${procDateExpr} <= $${from ? "3" : "2"}::timestamp` : ""}
     GROUP BY DATE(${procDateExpr})
     ORDER BY day DESC
     LIMIT 60`,
    clinicId,
    ...(from ? [from] : []),
    ...(to ? [to] : [])
  );

  // [DASH-3] Helper pra receita liquida.
  const liquido = (agg: { _sum: { value: number | null; discountAmount: number | null } }) =>
    (agg._sum.value ?? 0) - (agg._sum.discountAmount ?? 0);

  const totalRevenue = liquido(revenueAgg);
  const totalProcedures = revenueAgg._count.id;
  const ticketMedio = totalProcedures > 0 ? totalRevenue / totalProcedures : 0;

  return NextResponse.json({
    data: {
      // KPIs principais
      totalRevenue,
      totalProcedures,
      ticketMedio,
      activePatients: activePatients.length,
      pendingRevenue: liquido(pendingAgg),
      pendingCount: pendingAgg._count.id,
      cancelledRevenue: liquido(cancelledAgg),
      cancelledCount: cancelledAgg._count.id,
      // Detalhes — receita liquida
      topProcedures: topProcedures.map((p) => {
        const rev = (p._sum.value ?? 0) - (p._sum.discountAmount ?? 0);
        return {
          name: p.name,
          count: p._count.id,
          revenue: rev,
          ticketMedio: p._count.id > 0 ? rev / p._count.id : 0,
        };
      }),
      procedureBreakdown: procedureBreakdown.map((s) => ({
        // status agora vem do statusDescription (granularidade certa do Clinicorp)
        status: s.statusDescription ?? "unknown",
        count: s._count.id,
        revenue: (s._sum.value ?? 0) - (s._sum.discountAmount ?? 0),
      })),
      revenueByDay: revenueByDay.reverse().map((r) => ({
        day: r.day,
        revenue: Number(r.total),
        count: Number(r.count),
      })),
    },
  });
}

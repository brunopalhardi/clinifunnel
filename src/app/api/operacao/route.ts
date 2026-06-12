// [DASH-5] /api/operacao — KPIs da OPERACAO da clinica (Clinicorp-centric).
//
// Unifica o que estava em /api/financeiro (receita, procs, ticket medio) com
// agora um breakdown de Appointments (Atendidos / Faltas / Confirmadas /
// Aguardando) sem filtro Kommo — sao da clinica inteira, refletindo a
// operacao real (independente se o paciente veio do funil ou nao).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { APPROVED_PROCEDURE_FILTER } from "@/lib/dashboard-filters";
import { bucketCategoria, type CategoriaBucket } from "@/lib/metrics/patient-ticket";

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

  // Filtro de procedures: por createdAt (data de criacao do orcamento no Clinicorp).
  const procDateFilter = from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  // Filtro de appointments: por date (data marcada da consulta no Clinicorp).
  const appointmentDateFilter = from || to ? {
    date: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  const procFilter = { clinicId, ...APPROVED_PROCEDURE_FILTER, ...procDateFilter };

  const [
    revenueAgg,
    pendingAgg,
    cancelledAgg,
    activePatients,
    topProcedures,
    procedureBreakdown,
    appointmentsByStatus,
    atendidosPorCategoria,
  ] = await Promise.all([
    prisma.procedure.aggregate({
      where: procFilter,
      _count: { id: true },
      _sum: { value: true, discountAmount: true },
    }),
    prisma.procedure.aggregate({
      where: { clinicId, statusDescription: "Orçamento", deleted: false, ...procDateFilter },
      _count: { id: true },
      _sum: { value: true, discountAmount: true },
    }),
    prisma.procedure.aggregate({
      where: { clinicId, statusDescription: "Cancelado", deleted: false, ...procDateFilter },
      _count: { id: true },
      _sum: { value: true, discountAmount: true },
    }),
    prisma.procedure.findMany({
      where: procFilter,
      select: { patientId: true },
      distinct: ["patientId"],
    }),
    prisma.procedure.groupBy({
      by: ["name"],
      where: procFilter,
      _sum: { value: true, discountAmount: true },
      _count: { id: true },
      orderBy: { _sum: { value: "desc" } },
      take: 10,
    }),
    prisma.procedure.groupBy({
      by: ["statusDescription"],
      where: { clinicId, deleted: false, ...procDateFilter },
      _sum: { value: true, discountAmount: true },
      _count: { id: true },
    }),
    // [DASH-5] Appointments por statusKey TODA a clinica (sem filtro de funil).
    prisma.appointment.groupBy({
      by: ["statusKey"],
      where: { clinicId, deleted: false, ...appointmentDateFilter },
      _count: { id: true },
    }),
    // [DASH-15] Atendidos por categoryDescription — para breakdown de tipo de consulta.
    prisma.appointment.groupBy({
      by: ["categoryDescription"],
      where: { clinicId, deleted: false, statusKey: "atendido", ...appointmentDateFilter },
      _count: { id: true },
    }),
  ]);

  // Receita por dia
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

  const liquido = (agg: { _sum: { value: number | null; discountAmount: number | null } }) =>
    (agg._sum.value ?? 0) - (agg._sum.discountAmount ?? 0);

  const totalRevenue = liquido(revenueAgg);
  const totalProcedures = revenueAgg._count.id;
  const ticketMedio = totalProcedures > 0 ? totalRevenue / totalProcedures : 0;

  // [DASH-5.1] Desconto total concedido no periodo (rateio proporcional via DASH-3).
  // So conta procedures Aprovado — orcamentos abertos e cancelados nao tem desconto
  // efetivo (mesmo escopo do `revenueAgg`). Conta tambem quantos procedures tiveram
  // desconto > 0 pra calcular "ticket medio de desconto por procedure que recebeu".
  const totalDiscount = revenueAgg._sum.discountAmount ?? 0;
  const totalRevenueBruto = revenueAgg._sum.value ?? 0;
  const discountPercent = totalRevenueBruto > 0 ? (totalDiscount / totalRevenueBruto) * 100 : 0;
  const discountedProceduresCount = await prisma.procedure.count({
    where: { ...procFilter, discountAmount: { gt: 0 } },
  });

  // Breakdown de appointments
  const apptByStatus = appointmentsByStatus.reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.statusKey] = row._count.id;
      return acc;
    },
    {},
  );
  const totalAppointments = appointmentsByStatus.reduce((a, r) => a + r._count.id, 0);
  const atendidos = apptByStatus.atendido ?? 0;
  const faltaram = apptByStatus.faltou ?? 0;
  const taxaNoShow = atendidos + faltaram > 0 ? (faltaram / (atendidos + faltaram)) * 100 : 0;

  return NextResponse.json({
    data: {
      // Financeiro (mantido pra retrocompat com /dashboard/financeiro antigo)
      totalRevenue,
      totalProcedures,
      ticketMedio,
      activePatients: activePatients.length,
      pendingRevenue: liquido(pendingAgg),
      pendingCount: pendingAgg._count.id,
      cancelledRevenue: liquido(cancelledAgg),
      cancelledCount: cancelledAgg._count.id,
      // [DASH-5.1] Desconto concedido no periodo
      discounts: {
        total: totalDiscount,
        percent: discountPercent,
        proceduresWithDiscount: discountedProceduresCount,
        revenueBruto: totalRevenueBruto,
      },
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
        status: s.statusDescription ?? "unknown",
        count: s._count.id,
        revenue: (s._sum.value ?? 0) - (s._sum.discountAmount ?? 0),
      })),
      revenueByDay: revenueByDay.reverse().map((r) => ({
        day: r.day,
        revenue: Number(r.total),
        count: Number(r.count),
      })),
      // [DASH-5] Operacao: appointments TODA a clinica
      appointments: {
        total: totalAppointments,
        atendidos,
        faltaram,
        confirmadas: apptByStatus.confirmado ?? 0,
        aguardando: apptByStatus.agendado ?? 0,
        emEspera: apptByStatus.em_espera ?? 0,
        emAtendimento: apptByStatus.em_atendimento ?? 0,
        atrasadas: apptByStatus.atrasado ?? 0,
        taxaNoShow,
        // [DASH-15] Atendidos por tipo de consulta (tag das SDRs no Clinicorp)
        atendidosPorTipo: atendidosPorCategoria.reduce<Partial<Record<CategoriaBucket, number>>>((acc, row) => {
          const bucket = bucketCategoria(row.categoryDescription);
          acc[bucket] = (acc[bucket] ?? 0) + row._count.id;
          return acc;
        }, {}),
      },
    },
  });
}

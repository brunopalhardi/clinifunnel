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
  const patientType = searchParams.get("patientType");

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { pipelineId: true },
  });

  const pipelineFilter = clinic?.pipelineId
    ? { kommoPipelineId: clinic.pipelineId }
    : {};

  const patientTypeFilter = patientType === "new"
    ? { isNewPatient: true }
    : patientType === "returning"
      ? { isNewPatient: false }
      : {};

  const procedureDateFilter = from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  const leadDateFilter = from || to ? {
    kommoCreatedAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  const adDateFilter = from || to ? {
    date: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  // Patients with revenue (linked to leads in the funnel)
  const patientsWithRevenue = await prisma.patient.findMany({
    where: {
      clinicId,
      leads: { some: { ...pipelineFilter, ...patientTypeFilter } },
      procedures: {
        some: { status: { in: ["completed", "approved"] }, ...procedureDateFilter },
      },
    },
    include: {
      leads: {
        where: { ...pipelineFilter, ...patientTypeFilter },
        select: {
          canalProspeccao: true,
          channel: true,
          utmCampaign: true,
          kommoCreatedAt: true,
          isNewPatient: true,
        },
        take: 1,
        orderBy: { kommoCreatedAt: "asc" },
      },
      procedures: {
        where: { status: { in: ["completed", "approved"] }, ...procedureDateFilter },
        select: { value: true, createdAt: true, name: true },
      },
    },
  });

  // Leads per canal
  const canalMap = new Map<string, { leads: number; patients: number; revenue: number; procedures: number }>();

  const leadsByCanal = await prisma.lead.groupBy({
    by: ["canalProspeccao"],
    where: { clinicId, ...pipelineFilter, ...patientTypeFilter, ...leadDateFilter },
    _count: { id: true },
  });

  for (const row of leadsByCanal) {
    const canal = row.canalProspeccao ?? "Nao identificado";
    canalMap.set(canal, { leads: row._count.id, patients: 0, revenue: 0, procedures: 0 });
  }

  for (const patient of patientsWithRevenue) {
    const canal = patient.leads[0]?.canalProspeccao ?? "Nao identificado";
    const entry = canalMap.get(canal) ?? { leads: 0, patients: 0, revenue: 0, procedures: 0 };
    entry.patients += 1;
    entry.procedures += patient.procedures.length;
    entry.revenue += patient.procedures.reduce((sum, p) => sum + p.value, 0);
    canalMap.set(canal, entry);
  }

  // Ad spend
  const adSpend = await prisma.adCampaignData.aggregate({
    where: { clinicId, ...adDateFilter },
    _sum: { spend: true },
  });
  const totalAdSpend = adSpend._sum.spend ?? 0;

  // LTV per patient
  const patientLTVs = patientsWithRevenue.map((p) => {
    const totalRevenue = p.procedures.reduce((sum, proc) => sum + proc.value, 0);
    const firstLead = p.leads[0];
    const firstProcedure = p.procedures.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )[0];
    const leadToRevenueMs =
      firstLead?.kommoCreatedAt && firstProcedure
        ? firstProcedure.createdAt.getTime() - firstLead.kommoCreatedAt.getTime()
        : null;

    return {
      patientId: p.id,
      name: p.name,
      canal: firstLead?.canalProspeccao ?? "Nao identificado",
      totalRevenue,
      procedureCount: p.procedures.length,
      leadToRevenueDays: leadToRevenueMs !== null
        ? Math.round(leadToRevenueMs / (1000 * 60 * 60 * 24))
        : null,
    };
  });

  const totalRevenue = patientLTVs.reduce((sum, p) => sum + p.totalRevenue, 0);
  const avgLTV = patientLTVs.length > 0 ? totalRevenue / patientLTVs.length : 0;
  const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : null;

  const leadToRevenueDays = patientLTVs
    .filter((p) => p.leadToRevenueDays !== null)
    .map((p) => p.leadToRevenueDays!);
  const avgLeadToRevenue = leadToRevenueDays.length > 0
    ? Math.round(leadToRevenueDays.reduce((a, b) => a + b, 0) / leadToRevenueDays.length)
    : null;

  const canalPerformance = Array.from(canalMap.entries()).map(([canal, data]) => ({
    canal,
    ...data,
    avgLTV: data.patients > 0 ? data.revenue / data.patients : 0,
    conversionRate: data.leads > 0 ? (data.patients / data.leads) * 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({
    data: {
      totalRevenue,
      totalAdSpend,
      roas,
      avgLTV,
      avgLeadToRevenueDays: avgLeadToRevenue,
      totalPatients: patientLTVs.length,
      canalPerformance,
      topPatients: patientLTVs
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10),
    },
  });
}

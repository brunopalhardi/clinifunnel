import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeHealthChecks, type HealthCounts } from "@/lib/clinicorp/health";
import { PermissionDeniedError, requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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
    select: {
      kommoSubdomain: true,
      kommoToken: true,
      pipelineId: true,
      stageAgendamento: true,
      clinicorpUser: true,
      clinicorpToken: true,
      clinicorpBusinessId: true,
      clinicorpAutoCreatePatient: true,
      clinicorpWebhookEnabled: true,
      professionalMap: true,
      lastClinicorpSyncAt: true,
      lastMatchLeadsAt: true,
    },
  });

  if (!clinic) {
    return NextResponse.json({ error: "Clinica nao encontrada" }, { status: 404 });
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    kommoWebhooks24h,
    clinicorpWebhooks24h,
    errorWebhooks24h,
    leadsCreated24h,
    proceduresCreated24h,
  ] = await Promise.all([
    prisma.webhookLog.count({
      where: { clinicId: id, source: "kommo", createdAt: { gte: since24h } },
    }),
    prisma.webhookLog.count({
      where: { clinicId: id, source: "clinicorp", createdAt: { gte: since24h } },
    }),
    prisma.webhookLog.count({
      where: { clinicId: id, status: "error", createdAt: { gte: since24h } },
    }),
    prisma.lead.count({
      where: { clinicId: id, createdAt: { gte: since24h } },
    }),
    prisma.procedure.count({
      where: { clinicId: id, createdAt: { gte: since24h } },
    }),
  ]);

  const counts: HealthCounts = {
    kommoWebhooks24h,
    clinicorpWebhooks24h,
    errorWebhooks24h,
    leadsCreated24h,
    proceduresCreated24h,
  };

  const checks = computeHealthChecks(
    {
      // kommoToken/kommoSubdomain sao non-null no schema mas tipos sao non-null;
      // computeHealthChecks aceita nullable pra preparar pra futuras mudancas.
      kommoSubdomain: clinic.kommoSubdomain,
      kommoToken: clinic.kommoToken,
      pipelineId: clinic.pipelineId,
      stageAgendamento: clinic.stageAgendamento,
      clinicorpUser: clinic.clinicorpUser,
      clinicorpToken: clinic.clinicorpToken,
      clinicorpBusinessId: clinic.clinicorpBusinessId,
      clinicorpAutoCreatePatient: clinic.clinicorpAutoCreatePatient,
      clinicorpWebhookEnabled: clinic.clinicorpWebhookEnabled,
      professionalMap: clinic.professionalMap,
      lastClinicorpSyncAt: clinic.lastClinicorpSyncAt,
      lastMatchLeadsAt: clinic.lastMatchLeadsAt,
    },
    counts,
  );

  return NextResponse.json({ data: { checks, counts } });
}

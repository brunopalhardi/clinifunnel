import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function maskToken(token: string | null): string {
  if (!token || token.length < 8) return token ? "****" : "";
  return token.slice(0, 4) + "****" + token.slice(-4);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const clinic = await prisma.clinic.findUnique({ where: { id } });

  if (!clinic) {
    return NextResponse.json({ error: "Clinica nao encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: clinic.id,
      name: clinic.name,
      kommoSubdomain: clinic.kommoSubdomain,
      kommoToken: maskToken(clinic.kommoToken),
      pipelineId: clinic.pipelineId,
      stageAgendamento: clinic.stageAgendamento,
      clinicorpUser: clinic.clinicorpUser ?? "",
      clinicorpToken: maskToken(clinic.clinicorpToken),
      clinicorpBusinessId: clinic.clinicorpBusinessId ?? "",
      clinicorpAutoCreatePatient: clinic.clinicorpAutoCreatePatient,
      clinicorpWebhookEnabled: clinic.clinicorpWebhookEnabled,
      hasKommo: !!clinic.kommoToken,
      hasClinicorp: !!clinic.clinicorpUser && !!clinic.clinicorpToken,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const clinic = await prisma.clinic.findUnique({ where: { id } });
  if (!clinic) {
    return NextResponse.json({ error: "Clinica nao encontrada" }, { status: 404 });
  }

  const allowedFields = [
    "name",
    "kommoSubdomain",
    "kommoToken",
    "pipelineId",
    "stageAgendamento",
    "clinicorpUser",
    "clinicorpToken",
    "clinicorpBusinessId",
  ] as const;

  const data: Record<string, string | boolean> = {};
  for (const field of allowedFields) {
    if (field in body && typeof body[field] === "string") {
      // Don't overwrite token with masked value
      if (
        (field === "kommoToken" || field === "clinicorpToken") &&
        body[field].includes("****")
      ) {
        continue;
      }
      data[field] = body[field];
    }
  }

  // Boolean toggles
  const booleanFields = [
    "clinicorpAutoCreatePatient",
    "clinicorpWebhookEnabled",
  ] as const;
  for (const field of booleanFields) {
    if (field in body && typeof body[field] === "boolean") {
      data[field] = body[field];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Nenhum campo valido para atualizar" },
      { status: 400 }
    );
  }

  const updated = await prisma.clinic.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
      kommoSubdomain: updated.kommoSubdomain,
      hasKommo: !!updated.kommoToken,
      hasClinicorp: !!updated.clinicorpUser && !!updated.clinicorpToken,
    },
  });
}

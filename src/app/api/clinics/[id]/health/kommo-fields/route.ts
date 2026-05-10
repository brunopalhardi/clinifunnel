import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KommoClient } from "@/lib/kommo/client";
import { checkKommoCustomFields } from "@/lib/clinicorp/health";
import { PermissionDeniedError, requirePermission } from "@/lib/permissions";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = logger.child({ scope: "api/clinics/health/kommo-fields" });

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
    select: { kommoSubdomain: true, kommoToken: true },
  });

  if (!clinic) {
    return NextResponse.json({ error: "Clinica nao encontrada" }, { status: 404 });
  }

  if (!clinic.kommoSubdomain || !clinic.kommoToken) {
    return NextResponse.json(
      { error: "Kommo nao configurado nesta clinica" },
      { status: 400 },
    );
  }

  try {
    const client = new KommoClient(clinic.kommoSubdomain, clinic.kommoToken);
    const fields = await client.getCustomFields();
    const checks = checkKommoCustomFields(
      fields.map((f) => ({ id: f.id, name: f.name, type: f.type, code: f.code })),
    );
    return NextResponse.json({
      data: { checks, fieldCount: fields.length },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    log.error({ clinicId: id, err: msg }, "kommo getCustomFields failed");
    return NextResponse.json(
      { error: `Erro ao consultar Kommo: ${msg}` },
      { status: 502 },
    );
  }
}

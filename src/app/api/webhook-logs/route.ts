import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // WebhookLog ainda nao tem coluna clinicId (payload e Json cru). Sem isso
  // nao conseguimos isolar logs por clinica. Antes desta auditoria, clinic_admin
  // de qualquer clinica via logs de TODAS as clinicas — vazamento de payloads.
  // Restringimos ao super_admin ate [SEC-2.1] adicionar clinicId no schema.
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const where: Record<string, unknown> = {};
  if (source) where.source = source;
  if (status) where.status = status;

  const logs = await prisma.webhookLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });

  return NextResponse.json({ data: logs });
}

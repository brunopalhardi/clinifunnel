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

  // [SEC-2.1] resolveu o gap de clinicId. Agora:
  // - super_admin: ve tudo (incluindo logs legacy sem clinicId)
  // - clinic_admin: ve so logs da propria clinica (legacy sem clinicId nao
  //   aparece — esses ficam "orfaos" mas a alternativa de mostrar a todos
  //   reabriria o vazamento original)
  // - role "user": sem acesso (logs incluem payloads sensiveis)
  if (session.user.role === "user") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const where: Record<string, unknown> = {};
  if (source) where.source = source;
  if (status) where.status = status;
  if (session.user.role !== "super_admin") {
    where.clinicId = session.user.clinicId;
  }

  const logs = await prisma.webhookLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });

  return NextResponse.json({ data: logs });
}

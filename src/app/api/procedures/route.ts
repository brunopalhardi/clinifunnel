import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

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

  // [DASH-3] Default oculta procedures deletados. Status agora aceita tanto
  // legacy ("approved", "pending") quanto statusDescription do Clinicorp
  // ("Aprovado", "Orçamento"). Page de Procedimentos no dashboard nao filtra
  // por status — vai mostrar todos, e listagem ja exclui deleted.
  const where: Record<string, unknown> = { clinicId, deleted: false };

  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const procedures = await prisma.procedure.findMany({
    where,
    include: {
      patient: {
        select: { name: true, utmCampaign: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: procedures });
}

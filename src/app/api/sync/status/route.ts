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

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { lastClinicorpSyncAt: true, lastMatchLeadsAt: true },
  });

  return NextResponse.json({
    data: {
      lastSyncAt: clinic?.lastClinicorpSyncAt?.toISOString() ?? null,
      lastMatchAt: clinic?.lastMatchLeadsAt?.toISOString() ?? null,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const SEEDS: Array<{ procedureNamePattern: string; days: number }> = [
  { procedureNamePattern: "botox", days: 120 },
  { procedureNamePattern: "toxina", days: 120 },
  { procedureNamePattern: "preenchimento", days: 240 },
  { procedureNamePattern: "filler", days: 240 },
  { procedureNamePattern: "bioestimulador", days: 365 },
];

export async function POST(request: NextRequest) {
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

  const existing = await prisma.procedureRecallInterval.findMany({
    where: { clinicId },
    select: { procedureNamePattern: true },
  });
  const existingLower = new Set(existing.map((e) => e.procedureNamePattern.toLowerCase()));

  let created = 0;
  for (const s of SEEDS) {
    if (existingLower.has(s.procedureNamePattern.toLowerCase())) continue;
    await prisma.procedureRecallInterval.create({ data: { clinicId, ...s } });
    created++;
  }

  return NextResponse.json({ created, skipped: SEEDS.length - created });
}

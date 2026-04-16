import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // super_admin vê todas as clínicas, demais veem só a própria
  if (session.user.role === "super_admin") {
    const clinics = await prisma.clinic.findMany({
      select: { id: true, name: true, kommoSubdomain: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: clinics });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: session.user.clinicId },
    select: { id: true, name: true, kommoSubdomain: true },
  });
  return NextResponse.json({ data: clinic ? [clinic] : [] });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Apenas super_admin pode criar clinicas" }, { status: 403 });
  }

  const body = await request.json();
  const { name, kommoSubdomain } = body as { name?: string; kommoSubdomain?: string };

  if (!name || !kommoSubdomain) {
    return NextResponse.json({ error: "name e kommoSubdomain sao obrigatorios" }, { status: 400 });
  }

  const existing = await prisma.clinic.findUnique({ where: { kommoSubdomain } });
  if (existing) {
    return NextResponse.json({ error: "Ja existe uma clinica com esse subdominio" }, { status: 409 });
  }

  const clinic = await prisma.clinic.create({
    data: { name, kommoSubdomain, kommoToken: "" },
    select: { id: true, name: true, kommoSubdomain: true },
  });

  return NextResponse.json({ data: clinic }, { status: 201 });
}

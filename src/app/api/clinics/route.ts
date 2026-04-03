import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clinics = await prisma.clinic.findMany({
    select: {
      id: true,
      name: true,
      kommoSubdomain: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: clinics });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { name, kommoSubdomain } = body as {
    name?: string;
    kommoSubdomain?: string;
  };

  if (!name || !kommoSubdomain) {
    return NextResponse.json(
      { error: "name e kommoSubdomain sao obrigatorios" },
      { status: 400 }
    );
  }

  const existing = await prisma.clinic.findUnique({
    where: { kommoSubdomain },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Ja existe uma clinica com esse subdominio" },
      { status: 409 }
    );
  }

  const clinic = await prisma.clinic.create({
    data: {
      name,
      kommoSubdomain,
      kommoToken: "",
    },
    select: {
      id: true,
      name: true,
      kommoSubdomain: true,
    },
  });

  return NextResponse.json({ data: clinic }, { status: 201 });
}

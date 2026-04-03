import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    await prisma.webhookLog.create({
      data: {
        source: "clinicorp",
        event: "incoming",
        payload,
        status: "received",
      },
    });

    // TODO: Process Clinicorp webhooks when API docs are validated
    // Possible events: procedure completed, appointment confirmed, etc.

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Clinicorp webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

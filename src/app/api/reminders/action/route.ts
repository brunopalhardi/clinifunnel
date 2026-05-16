import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = ["TRATADO", "ADIADO", "DISPENSADO"] as const;
type ValidAction = (typeof VALID_ACTIONS)[number];

function isValidAction(s: unknown): s is ValidAction {
  return typeof s === "string" && (VALID_ACTIONS as readonly string[]).includes(s);
}

export async function POST(request: NextRequest) {
  let clinicId: string;
  let userId: string;
  try {
    const auth = await getAuthorizedClinicId(request);
    clinicId = auth.clinicId;
    userId = auth.userId;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro de autorizacao" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const reminderKey = typeof b.reminderKey === "string" ? b.reminderKey.trim() : "";
  if (!reminderKey || reminderKey.length > 200) {
    return NextResponse.json({ error: "reminderKey obrigatorio" }, { status: 400 });
  }
  if (!isValidAction(b.action)) {
    return NextResponse.json({ error: "action invalida" }, { status: 400 });
  }
  const action: ValidAction = b.action;

  let snoozeUntil: Date | null = null;
  if (action === "ADIADO") {
    if (typeof b.snoozeUntil !== "string") {
      return NextResponse.json({ error: "snoozeUntil obrigatorio para ADIADO" }, { status: 400 });
    }
    const d = new Date(b.snoozeUntil);
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      return NextResponse.json({ error: "snoozeUntil deve ser data futura" }, { status: 400 });
    }
    snoozeUntil = d;
  }

  let notes: string | null = null;
  if (typeof b.notes === "string" && b.notes.trim()) {
    notes = b.notes.trim().slice(0, 500);
  }

  await prisma.reminderAction.create({
    data: {
      clinicId,
      reminderKey,
      action,
      snoozeUntil,
      notes,
      createdById: userId,
    },
  });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { type } = await request.json();

  // TODO: Trigger BullMQ jobs manually
  // Types: "kommo" | "clinicorp" | "match"

  return NextResponse.json({
    message: `Sync job "${type}" enqueued`,
    status: "pending",
  });
}

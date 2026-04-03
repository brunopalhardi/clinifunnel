import { NextRequest, NextResponse } from "next/server";
import { matchLeadsQueue } from "@/workers/match-leads";
import { syncClinicorpQueue } from "@/workers/sync-clinicorp";

export async function POST(request: NextRequest) {
  const { type } = await request.json();

  const jobs: string[] = [];

  if (type === "all" || type === "match") {
    await matchLeadsQueue.add("match-leads", {}, { removeOnComplete: 100 });
    jobs.push("match-leads");
  }

  if (type === "all" || type === "clinicorp") {
    await syncClinicorpQueue.add("sync-clinicorp", {}, { removeOnComplete: 100 });
    jobs.push("sync-clinicorp");
  }

  return NextResponse.json({
    message: `Sync jobs enqueued: ${jobs.join(", ")}`,
    jobs,
  });
}

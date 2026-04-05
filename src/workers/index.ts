import "dotenv/config";
import { createPatientWorker } from "./create-patient";
import { processProcedureWorker } from "./process-procedure";
import { matchLeadsWorker } from "./match-leads";
import { syncClinicorpWorker } from "./sync-clinicorp";
import { syncMetaAdsWorker } from "./sync-meta-ads";
import { syncGoogleAdsWorker } from "./sync-google-ads";

console.log("[workers] Starting CliniFunnel workers...");
console.log("[workers] create-patient worker ready");
console.log("[workers] process-procedure worker ready");
console.log("[workers] match-leads worker ready");
console.log("[workers] sync-clinicorp worker ready");
console.log("[workers] sync-meta-ads worker ready");
console.log("[workers] sync-google-ads worker ready");

// Graceful shutdown
const shutdown = async () => {
  console.log("[workers] Shutting down...");
  await Promise.all([
    createPatientWorker.close(),
    processProcedureWorker.close(),
    matchLeadsWorker.close(),
    syncClinicorpWorker.close(),
    syncMetaAdsWorker.close(),
    syncGoogleAdsWorker.close(),
  ]);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

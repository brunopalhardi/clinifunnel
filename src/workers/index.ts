import "dotenv/config";
import { logger } from "@/lib/logger";
import { createPatientWorker } from "./create-patient";
import { processKommoLeadWorker } from "./process-kommo-lead";
import { processProcedureWorker } from "./process-procedure";
import { matchLeadsWorker } from "./match-leads";
import { syncClinicorpWorker } from "./sync-clinicorp";
import { syncMetaAdsWorker } from "./sync-meta-ads";
import { syncGoogleAdsWorker } from "./sync-google-ads";
import { webhookLogCleanupWorker } from "./webhook-log-cleanup";

const log = logger.child({ scope: "workers" });

const WORKERS = [
  "create-patient",
  "process-kommo-lead",
  "process-procedure",
  "match-leads",
  "sync-clinicorp",
  "sync-meta-ads",
  "sync-google-ads",
  "webhook-log-cleanup",
];
log.info({ workers: WORKERS }, "starting CliniFunnel workers");

const shutdown = async () => {
  log.info("shutting down");
  await Promise.all([
    createPatientWorker.close(),
    processKommoLeadWorker.close(),
    processProcedureWorker.close(),
    matchLeadsWorker.close(),
    syncClinicorpWorker.close(),
    syncMetaAdsWorker.close(),
    syncGoogleAdsWorker.close(),
    webhookLogCleanupWorker.close(),
  ]);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

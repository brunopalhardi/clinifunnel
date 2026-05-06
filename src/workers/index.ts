import "dotenv/config";
import { logger } from "@/lib/logger";
import { createPatientWorker } from "./create-patient";
import { processProcedureWorker } from "./process-procedure";
import { matchLeadsWorker } from "./match-leads";
import { syncClinicorpWorker } from "./sync-clinicorp";
import { syncMetaAdsWorker } from "./sync-meta-ads";
import { syncGoogleAdsWorker } from "./sync-google-ads";
import { checkRemindersWorker } from "./check-reminders";
import { webhookLogCleanupWorker } from "./webhook-log-cleanup";

const log = logger.child({ scope: "workers" });

const WORKERS = [
  "create-patient",
  "process-procedure",
  "match-leads",
  "sync-clinicorp",
  "sync-meta-ads",
  "sync-google-ads",
  "check-reminders",
  "webhook-log-cleanup",
];
log.info({ workers: WORKERS }, "starting CliniFunnel workers");

const shutdown = async () => {
  log.info("shutting down");
  await Promise.all([
    createPatientWorker.close(),
    processProcedureWorker.close(),
    matchLeadsWorker.close(),
    syncClinicorpWorker.close(),
    syncMetaAdsWorker.close(),
    syncGoogleAdsWorker.close(),
    checkRemindersWorker.close(),
    webhookLogCleanupWorker.close(),
  ]);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

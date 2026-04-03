import "dotenv/config";
import { createPatientWorker } from "./create-patient";

console.log("[workers] Starting OdontoFunil workers...");
console.log("[workers] create-patient worker ready");

// Graceful shutdown
const shutdown = async () => {
  console.log("[workers] Shutting down...");
  await createPatientWorker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Logger estruturado JSON usando pino.
//
// Em producao: JSON puro pra ser parseado por agregadores (docker service logs,
// CloudWatch, etc).
// Em dev: pino-pretty se PRETTY_LOGS=1, senao mesmo JSON pra paridade com prod.
//
// Uso:
//   import { logger } from "@/lib/logger";
//   const log = logger.child({ scope: "create-patient", clinicId, leadId });
//   log.info({ kommoLeadId }, "lead criado");
//   log.error({ err }, "falha ao criar paciente");

import pino, { Logger } from "pino";

const pretty = process.env.PRETTY_LOGS === "1";
const level = process.env.LOG_LEVEL || "info";

// Sanitiza objetos com chaves sensiveis. Pino aplica antes do output.
const REDACT_PATHS = [
  "*.kommoToken",
  "*.clinicorpToken",
  "*.metaAccessToken",
  "*.googleAdsRefreshToken",
  "*.password",
  "*.passwordHash",
  "*.NEXTAUTH_SECRET",
  "*.INTEGRATION_TOKENS_KEY",
  "kommoToken",
  "clinicorpToken",
  "metaAccessToken",
  "googleAdsRefreshToken",
  "password",
  "passwordHash",
];

export const logger: Logger = pino({
  level,
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    // pino default formata level como numero (30, 40, ...). Texto e mais util.
    level(label) {
      return { level: label };
    },
  },
  ...(pretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss.l" },
        },
      }
    : {}),
});

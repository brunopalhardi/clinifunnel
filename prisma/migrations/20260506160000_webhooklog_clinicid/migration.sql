-- SEC-2.1: WebhookLog ganha clinicId nullable.
-- Nullable: webhooks chegam antes de identificar a clinica; legacy entries
-- pre-[SEC-2.1] nao tem esse campo (continuam null e so visiveis a super_admin).
ALTER TABLE "WebhookLog" ADD COLUMN "clinicId" TEXT;
CREATE INDEX "WebhookLog_clinicId_createdAt_idx" ON "WebhookLog"("clinicId", "createdAt");

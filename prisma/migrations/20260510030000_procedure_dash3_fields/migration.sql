-- [DASH-3] Adiciona 4 campos em Procedure pra refletir melhor a estrutura
-- de receita do Clinicorp: rateio de desconto + status no nivel-procedure
-- + flag de pagamento contabilizado + flag de deletado.

ALTER TABLE "Procedure"
  ADD COLUMN "discountAmount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "statusDescription" TEXT,
  ADD COLUMN "paymentAccounted"  BOOLEAN          NOT NULL DEFAULT false,
  ADD COLUMN "deleted"           BOOLEAN          NOT NULL DEFAULT false;

-- Index pra queries de dashboard filtradas por statusDescription
CREATE INDEX "Procedure_clinicId_statusDescription_idx"
  ON "Procedure" ("clinicId", "statusDescription");

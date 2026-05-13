-- [LEAD-2] Cache de stages do Kommo (ID -> {name, color, pipelineId})
-- pra traduzir Lead.kommoStatus em nome humano na UI.

ALTER TABLE "Clinic" ADD COLUMN "kommoStages" JSONB;

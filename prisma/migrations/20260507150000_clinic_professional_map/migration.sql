-- INT-2: Clinic ganha professionalMap (JSONB nullable).
-- Mapeia o nome do select ATENDIDO POR no Kommo para o Dentist_PersonId do Clinicorp.
-- Lookup em runtime e case/whitespace-insensitive (ver src/lib/clinicorp/professional-map.ts).
ALTER TABLE "Clinic" ADD COLUMN "professionalMap" JSONB;

-- AlterTable
ALTER TABLE "Clinic"
  ADD COLUMN "lastClinicorpSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastMatchLeadsAt" TIMESTAMP(3);

/*
  Warnings:

  - You are about to drop the column `clinicorpOAuth` on the `Clinic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Clinic" DROP COLUMN "clinicorpOAuth",
ADD COLUMN     "clinicorpBusinessId" TEXT,
ADD COLUMN     "clinicorpUser" TEXT;

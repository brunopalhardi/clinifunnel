-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "appointmentDate" TEXT,
ADD COLUMN     "appointmentProfId" TEXT,
ADD COLUMN     "appointmentTime" TEXT,
ADD COLUMN     "canalProspeccao" TEXT,
ADD COLUMN     "clinicorpAppointmentId" TEXT,
ADD COLUMN     "isNewPatient" BOOLEAN;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "canalProspeccao" TEXT;

-- CreateIndex
CREATE INDEX "Lead_clinicId_isNewPatient_idx" ON "Lead"("clinicId", "isNewPatient");

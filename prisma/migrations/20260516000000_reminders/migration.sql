-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN "recallInactiveMonths" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "Clinic" ADD COLUMN "recallPostConsultaDays" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "ProcedureRecallInterval" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "procedureNamePattern" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureRecallInterval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcedureRecallInterval_clinicId_idx" ON "ProcedureRecallInterval"("clinicId");

-- AddForeignKey
ALTER TABLE "ProcedureRecallInterval" ADD CONSTRAINT "ProcedureRecallInterval_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ReminderAction" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "reminderKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "snoozeUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ReminderAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderAction_clinicId_reminderKey_idx" ON "ReminderAction"("clinicId", "reminderKey");

-- AddForeignKey
ALTER TABLE "ReminderAction" ADD CONSTRAINT "ReminderAction_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

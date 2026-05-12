-- [DASH-4] Cria modelo Appointment pra refletir status do Clinicorp
-- (Atendido / Confirmado / Faltou / Agendado etc).

CREATE TABLE "Appointment" (
    "id"                     TEXT NOT NULL,
    "clinicId"               TEXT NOT NULL,
    "patientId"              TEXT,
    "clinicorpAppointmentId" TEXT NOT NULL,
    "date"                   TIMESTAMP(3) NOT NULL,
    "fromTime"               TEXT,
    "toTime"                 TEXT,
    "statusId"               TEXT,
    "statusColor"            TEXT,
    "statusKey"              TEXT NOT NULL DEFAULT 'agendado',
    "dentistName"            TEXT,
    "categoryDescription"    TEXT,
    "deleted"                BOOLEAN NOT NULL DEFAULT false,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Appointment_clinicId_clinicorpAppointmentId_key"
    ON "Appointment"("clinicId", "clinicorpAppointmentId");
CREATE INDEX "Appointment_clinicId_statusKey_date_idx"
    ON "Appointment"("clinicId", "statusKey", "date");
CREATE INDEX "Appointment_patientId_idx"
    ON "Appointment"("patientId");

ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processProcedureQueue } from "@/workers/process-procedure";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const logEntry = await prisma.webhookLog.create({
      data: {
        source: "clinicorp",
        event: payload.event ?? payload.type ?? "unknown",
        payload,
        status: "received",
      },
    });

    // Identify the clinic by matching clinicorp credentials
    // Clinicorp webhooks typically include subscriber_id or business_id
    const subscriberId =
      payload.subscriber_id ?? payload.subscriberId ?? payload.business_id;

    let clinic = null;
    if (subscriberId) {
      clinic = await prisma.clinic.findFirst({
        where: {
          OR: [
            { clinicorpUser: String(subscriberId) },
            { clinicorpBusinessId: String(subscriberId) },
          ],
        },
      });
    }

    // If we can't identify the clinic, try from the first clinic (single-tenant)
    if (!clinic) {
      clinic = await prisma.clinic.findFirst({
        where: {
          clinicorpUser: { not: null },
          clinicorpToken: { not: null },
        },
      });
    }

    if (!clinic) {
      await prisma.webhookLog.update({
        where: { id: logEntry.id },
        data: { status: "error", error: "No matching clinic found" },
      });
      return NextResponse.json({ ok: true });
    }

    // Extract event type — Clinicorp may use different field names
    const eventType = (
      payload.event ??
      payload.type ??
      payload.action ??
      ""
    ).toLowerCase();

    // Process procedure-related events
    const procedureEvents = [
      "procedure",
      "treatment",
      "budget",
      "orcamento",
      "procedure.created",
      "procedure.updated",
      "procedure.completed",
      "treatment.created",
      "treatment.updated",
      "treatment.completed",
      "budget.approved",
      "budget.completed",
    ];

    const isProcedureEvent = procedureEvents.some(
      (e) => eventType.includes(e) || eventType === e
    );

    if (isProcedureEvent) {
      // Extract procedure data — handle multiple possible payload shapes
      const data = payload.data ?? payload;

      await processProcedureQueue.add(
        "process-procedure",
        {
          clinicId: clinic.id,
          event: eventType,
          payload: {
            procedureId: String(
              data.procedureId ??
                data.id ??
                data.treatmentId ??
                data.budgetId ??
                ""
            ),
            patientId: String(
              data.patientId ??
                data.patient_id ??
                data.Patient_PersonId ??
                ""
            ),
            patientName:
              data.patientName ?? data.PatientName ?? data.patient_name,
            patientPhone:
              data.patientPhone ??
              data.MobilePhone ??
              data.patient_phone,
            procedureName:
              data.procedureName ??
              data.name ??
              data.Name ??
              data.description ??
              data.Description,
            value: parseFloat(data.value ?? data.Value ?? data.amount ?? "0"),
            status: data.status ?? data.Status ?? eventType.split(".").pop(),
            completedAt: data.completedAt ?? data.completed_at ?? data.finishedAt,
          },
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        }
      );
    }

    // Process appointment-related events
    const appointmentEvents = [
      "appointment",
      "agendamento",
      "appointment.created",
      "appointment.confirmed",
      "appointment.cancelled",
    ];

    const isAppointmentEvent = appointmentEvents.some(
      (e) => eventType.includes(e) || eventType === e
    );

    if (isAppointmentEvent) {
      const data = payload.data ?? payload;
      const patientId = String(
        data.patientId ?? data.Patient_PersonId ?? data.patient_id ?? ""
      );

      // Find the patient and their linked lead, update agendamentoAt
      if (patientId) {
        const patient = await prisma.patient.findFirst({
          where: { clinicId: clinic.id, clinicorpPatientId: patientId },
          include: { leads: { where: { agendamentoAt: null }, take: 1 } },
        });

        if (patient && patient.leads.length > 0) {
          await prisma.lead.update({
            where: { id: patient.leads[0].id },
            data: { agendamentoAt: new Date() },
          });
          console.log(
            `[clinicorp-webhook] Updated agendamentoAt for lead ${patient.leads[0].name}`
          );
        }
      }
    }

    await prisma.webhookLog.update({
      where: { id: logEntry.id },
      data: { status: "processed" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Clinicorp webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

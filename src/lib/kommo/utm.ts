import { KommoCustomField } from "./types";
import { UTMData } from "@/types";

const UTM_FIELD_CODES: Record<string, keyof UTMData> = {
  UTM_SOURCE: "utmSource",
  UTM_MEDIUM: "utmMedium",
  UTM_CAMPAIGN: "utmCampaign",
  UTM_CONTENT: "utmContent",
  UTM_TERM: "utmTerm",
};

const UTM_FIELD_NAMES: Record<string, keyof UTMData> = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
};

export function extractUTMsFromCustomFields(
  fields: KommoCustomField[] | null
): UTMData {
  const utms: UTMData = {};
  if (!fields) return utms;

  for (const field of fields) {
    // Try matching by field_code first (more reliable)
    const byCode = field.field_code
      ? UTM_FIELD_CODES[field.field_code.toUpperCase()]
      : undefined;

    // Fallback to field_name
    const byName = UTM_FIELD_NAMES[field.field_name.toLowerCase()];

    const key = byCode || byName;
    if (key && field.values.length > 0) {
      utms[key] = field.values[0].value;
    }

    // Also check tracking_data type fields
    if (field.field_type === "tracking_data" && field.values.length > 0) {
      const value = field.values[0].value;
      try {
        const parsed = JSON.parse(value);
        if (parsed.utm_source) utms.utmSource = parsed.utm_source;
        if (parsed.utm_medium) utms.utmMedium = parsed.utm_medium;
        if (parsed.utm_campaign) utms.utmCampaign = parsed.utm_campaign;
        if (parsed.utm_content) utms.utmContent = parsed.utm_content;
        if (parsed.utm_term) utms.utmTerm = parsed.utm_term;
      } catch {
        // Not JSON, skip
      }
    }
  }

  return utms;
}

export function extractCanalProspeccao(
  fields: KommoCustomField[] | null | undefined
): string | null {
  if (!fields) return null;
  for (const field of fields) {
    const name = field.field_name?.toLowerCase() ?? "";
    const code = field.field_code?.toLowerCase() ?? "";
    if (
      name.includes("canal") ||
      name.includes("prospeccao") ||
      name.includes("prospecção") ||
      code.includes("canal") ||
      code === "prospeccao"
    ) {
      if (field.values.length > 0) return field.values[0].value;
    }
  }
  return null;
}

export interface AppointmentFields {
  appointmentDate: string | null;
  appointmentTime: string | null;
  appointmentProfId: string | null;
}

export function extractAppointmentFields(
  fields: KommoCustomField[] | null | undefined
): AppointmentFields {
  const result: AppointmentFields = {
    appointmentDate: null,
    appointmentTime: null,
    appointmentProfId: null,
  };
  if (!fields) return result;

  for (const field of fields) {
    const name = field.field_name?.toLowerCase() ?? "";
    const code = field.field_code?.toLowerCase() ?? "";
    const value = field.values?.[0]?.value;
    if (!value) continue;

    if (
      (name.includes("data") && (name.includes("consulta") || name.includes("agendamento"))) ||
      code === "appointment_date"
    ) {
      result.appointmentDate = value;
    }
    if (name.includes("hora") || name.includes("horario") || code === "appointment_time") {
      result.appointmentTime = value;
    }
    if (name.includes("profissional") || name.includes("dentista") || code === "professional_id") {
      result.appointmentProfId = value;
    }
  }
  return result;
}

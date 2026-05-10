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

const APPOINTMENT_TZ = "America/Sao_Paulo";

// Exportados pra reuso no health check (INT-4) — manter detecao runtime
// e detecao de presenca em sync.
export function hasAppointmentNameKeyword(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("data") && (n.includes("consulta") || n.includes("agendamento"));
}

export function hasTimeNameKeyword(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("hora") || n.includes("horario");
}

export function isProfessionalField(name: string, code: string): boolean {
  const n = name.toLowerCase();
  const c = code.toLowerCase();
  return (
    n.includes("profissional") ||
    n.includes("dentista") ||
    n.includes("atendido") ||
    c === "professional_id"
  );
}

function splitUnixTimestampToDateTime(value: string): { date: string; time: string } | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const d = new Date(seconds * 1000);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: APPOINTMENT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APPOINTMENT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { date, time };
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
    const type = field.field_type ?? "";
    const value = field.values?.[0]?.value;
    if (!value) continue;

    const isCombinedDateTime =
      hasAppointmentNameKeyword(name) &&
      (type === "date_time" || hasTimeNameKeyword(name));

    if (isCombinedDateTime) {
      const split = splitUnixTimestampToDateTime(value);
      if (split) {
        result.appointmentDate = split.date;
        result.appointmentTime = split.time;
      } else {
        result.appointmentDate = value;
      }
      continue;
    }

    if (hasAppointmentNameKeyword(name) || code === "appointment_date") {
      result.appointmentDate = value;
    }
    if (hasTimeNameKeyword(name) || code === "appointment_time") {
      result.appointmentTime = value;
    }
    if (isProfessionalField(name, code)) {
      result.appointmentProfId = value;
    }
  }
  return result;
}

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

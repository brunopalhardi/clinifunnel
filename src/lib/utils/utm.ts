import { UTMData } from "@/types";

export function hasUTMs(data: UTMData): boolean {
  return !!(
    data.utmSource ||
    data.utmMedium ||
    data.utmCampaign ||
    data.utmContent ||
    data.utmTerm
  );
}

export function classifyChannel(data: UTMData): "campaign" | "organic" {
  return hasUTMs(data) ? "campaign" : "organic";
}

export function utmsToTags(data: UTMData): string[] {
  const tags: string[] = [];
  if (data.utmSource) tags.push(`source:${data.utmSource}`);
  if (data.utmMedium) tags.push(`medium:${data.utmMedium}`);
  if (data.utmCampaign) tags.push(`campaign:${data.utmCampaign}`);
  if (data.utmContent) tags.push(`content:${data.utmContent}`);
  if (data.utmTerm) tags.push(`term:${data.utmTerm}`);
  return tags;
}

export function utmsToNote(data: UTMData): string {
  const parts: string[] = [];
  if (data.utmSource) parts.push(`Source: ${data.utmSource}`);
  if (data.utmMedium) parts.push(`Medium: ${data.utmMedium}`);
  if (data.utmCampaign) parts.push(`Campaign: ${data.utmCampaign}`);
  if (data.utmContent) parts.push(`Content: ${data.utmContent}`);
  if (data.utmTerm) parts.push(`Term: ${data.utmTerm}`);
  return `[OdontoFunil UTMs] ${parts.join(" | ")}`;
}

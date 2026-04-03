export type Channel = "campaign" | "organic";

export type ProcedureStatus = "pending" | "approved" | "completed" | "cancelled";

export type WebhookSource = "kommo" | "clinicorp";

export type WebhookStatus = "received" | "processed" | "error";

export interface UTMData {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

export interface FunnelMetrics {
  totalLeads: number;
  campaignLeads: number;
  organicLeads: number;
  agendamentos: number;
  procedimentos: number;
  totalRevenue: number;
  conversionRate: number;
}

export interface CampaignMetrics {
  campaign: string;
  leads: number;
  agendamentos: number;
  procedimentos: number;
  revenue: number;
  costPerLead?: number;
  roi?: number;
}

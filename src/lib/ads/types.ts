export type AdPlatform = "meta" | "google";

export interface AdInsight {
  campaignId: string;
  campaignName: string;
  date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  spend: number; // em BRL
}

export interface AdConnectionStatus {
  connected: boolean;
  accountId?: string;
  tokenExpiresAt?: string;
  lastSync?: string;
}

export interface AdsStatusResponse {
  meta: AdConnectionStatus;
  google: AdConnectionStatus;
}

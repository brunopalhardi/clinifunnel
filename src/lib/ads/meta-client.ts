import { AdInsight } from "./types";

const GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Client para Meta Marketing API (somente leitura).
 * Compliance Meta: apenas scope ads_read, nunca envia dados de pacientes.
 */
export class MetaAdsClient {
  constructor(
    private accessToken: string,
    private adAccountId: string
  ) {}

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${GRAPH_API}${path}`);
    url.searchParams.set("access_token", this.accessToken);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString());
    const json = await res.json();

    if (json.error) {
      const err = json.error as { code: number; message: string };
      throw new MetaApiError(err.message, err.code);
    }

    return json as T;
  }

  /**
   * Busca insights de campanhas com breakdown diário.
   * Retorna apenas dados de ad spend — zero dados de usuários.
   */
  async getCampaignInsights(dateFrom: string, dateTo: string): Promise<AdInsight[]> {
    interface InsightRow {
      campaign_id: string;
      campaign_name: string;
      date_start: string;
      impressions: string;
      clicks: string;
      spend: string;
    }

    interface InsightsResponse {
      data: InsightRow[];
      paging?: { next?: string };
    }

    const insights: AdInsight[] = [];
    let path = `/${this.adAccountId}/insights`;
    let hasMore = true;

    while (hasMore) {
      const result = await this.request<InsightsResponse>(path, {
        fields: "campaign_id,campaign_name,impressions,clicks,spend",
        level: "campaign",
        time_increment: "1",
        time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
        limit: "500",
      });

      for (const row of result.data) {
        insights.push({
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
          date: row.date_start,
          impressions: parseInt(row.impressions, 10) || 0,
          clicks: parseInt(row.clicks, 10) || 0,
          spend: parseFloat(row.spend) || 0,
        });
      }

      if (result.paging?.next) {
        // Para paginação do Meta, a URL completa é retornada
        const nextUrl = new URL(result.paging.next);
        path = nextUrl.pathname.replace("/v21.0", "");
      } else {
        hasMore = false;
      }
    }

    return insights;
  }

  /**
   * Busca ad accounts disponíveis para o usuário.
   */
  async getAdAccounts(): Promise<{ id: string; name: string }[]> {
    interface AdAccountsResponse {
      data: { id: string; name: string; account_id: string }[];
    }

    const result = await this.request<AdAccountsResponse>("/me/adaccounts", {
      fields: "id,name,account_id",
      limit: "100",
    });

    return result.data.map((a) => ({ id: a.id, name: a.name }));
  }

  /**
   * Troca token de longa duração por um novo (refresh proativo).
   * Meta não tem refresh token tradicional — troca-se o long-lived token
   * por outro antes de expirar.
   */
  static async refreshLongLivedToken(currentToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const url = new URL(`${GRAPH_API}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", process.env.META_APP_ID!);
    url.searchParams.set("client_secret", process.env.META_APP_SECRET!);
    url.searchParams.set("fb_exchange_token", currentToken);

    const res = await fetch(url.toString());
    const json = await res.json();

    if (json.error) {
      throw new MetaApiError(json.error.message, json.error.code);
    }

    return {
      accessToken: json.access_token,
      expiresIn: json.expires_in || 5184000, // default 60 dias
    };
  }

  /**
   * Troca authorization code por short-lived token, depois por long-lived.
   */
  static async exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // Step 1: code → short-lived token
    const shortUrl = new URL(`${GRAPH_API}/oauth/access_token`);
    shortUrl.searchParams.set("client_id", process.env.META_APP_ID!);
    shortUrl.searchParams.set("client_secret", process.env.META_APP_SECRET!);
    shortUrl.searchParams.set("redirect_uri", redirectUri);
    shortUrl.searchParams.set("code", code);

    const shortRes = await fetch(shortUrl.toString());
    const shortJson = await shortRes.json();

    if (shortJson.error) {
      throw new MetaApiError(shortJson.error.message, shortJson.error.code);
    }

    // Step 2: short-lived → long-lived token (60 dias)
    return MetaAdsClient.refreshLongLivedToken(shortJson.access_token);
  }
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public code: number
  ) {
    super(`Meta API Error (${code}): ${message}`);
    this.name = "MetaApiError";
  }

  /** Token expirado ou inválido */
  get isAuthError(): boolean {
    return this.code === 190;
  }
}

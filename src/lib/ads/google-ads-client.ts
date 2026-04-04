import { AdInsight } from "./types";

const GOOGLE_ADS_API = "https://googleads.googleapis.com/v17";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Client para Google Ads API (somente leitura via GAQL).
 * Usa refresh token para obter access tokens sob demanda.
 */
export class GoogleAdsClient {
  constructor(
    private refreshToken: string,
    private customerId: string
  ) {}

  /**
   * Obtém access token fresco via refresh token.
   */
  private async getAccessToken(): Promise<string> {
    const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const json = await res.json();

    if (json.error) {
      throw new GoogleAdsApiError(
        json.error_description || json.error,
        json.error === "invalid_grant" ? 401 : 400
      );
    }

    return json.access_token;
  }

  /**
   * Executa query GAQL via searchStream.
   */
  private async query<T>(gaql: string): Promise<T[]> {
    const accessToken = await this.getAccessToken();
    const customerId = this.customerId.replace(/-/g, "");

    const res = await fetch(
      `${GOOGLE_ADS_API}/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          "Content-Type": "application/json",
          ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
            ? { "login-customer-id": process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, "") }
            : {}),
        },
        body: JSON.stringify({ query: gaql }),
      }
    );

    const json = await res.json();

    if (json.error) {
      throw new GoogleAdsApiError(
        json.error.message || "Google Ads API error",
        json.error.code || 500
      );
    }

    // searchStream retorna array de batches
    const results: T[] = [];
    if (Array.isArray(json)) {
      for (const batch of json) {
        if (batch.results) {
          results.push(...batch.results);
        }
      }
    }

    return results;
  }

  /**
   * Busca métricas de campanhas com breakdown diário.
   */
  async getCampaignMetrics(dateFrom: string, dateTo: string): Promise<AdInsight[]> {
    interface GaqlRow {
      campaign: { id: string; name: string };
      metrics: { impressions: string; clicks: string; costMicros: string };
      segments: { date: string };
    }

    const gaql = `
      SELECT
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        segments.date
      FROM campaign
      WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
        AND campaign.status != 'REMOVED'
    `;

    const rows = await this.query<GaqlRow>(gaql);

    return rows.map((row) => ({
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      date: row.segments.date,
      impressions: parseInt(row.metrics.impressions, 10) || 0,
      clicks: parseInt(row.metrics.clicks, 10) || 0,
      // cost_micros está em micro-unidades (dividir por 1.000.000)
      spend: parseInt(row.metrics.costMicros, 10) / 1_000_000 || 0,
    }));
  }

  /**
   * Troca authorization code por refresh token.
   */
  static async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<{ refreshToken: string; accessToken: string }> {
    const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const json = await res.json();

    if (json.error) {
      throw new GoogleAdsApiError(
        json.error_description || json.error,
        400
      );
    }

    if (!json.refresh_token) {
      throw new GoogleAdsApiError(
        "No refresh_token returned. Ensure access_type=offline and prompt=consent.",
        400
      );
    }

    return {
      refreshToken: json.refresh_token,
      accessToken: json.access_token,
    };
  }

  /**
   * Lista customer IDs acessíveis (via listAccessibleCustomers).
   */
  static async listAccessibleCustomers(accessToken: string): Promise<string[]> {
    const res = await fetch(
      `${GOOGLE_ADS_API}/customers:listAccessibleCustomers`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        },
      }
    );

    const json = await res.json();

    if (json.error) {
      throw new GoogleAdsApiError(json.error.message, json.error.code);
    }

    // Retorna resource names como "customers/1234567890"
    return (json.resourceNames || []).map((rn: string) =>
      rn.replace("customers/", "")
    );
  }
}

export class GoogleAdsApiError extends Error {
  constructor(
    message: string,
    public code: number
  ) {
    super(`Google Ads API Error (${code}): ${message}`);
    this.name = "GoogleAdsApiError";
  }

  get isAuthError(): boolean {
    return this.code === 401;
  }
}

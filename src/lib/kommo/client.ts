import { KommoLead, KommoPipeline } from "./types";

export class KommoClient {
  private baseUrl: string;
  private token: string;

  constructor(subdomain: string, token: string) {
    this.baseUrl = `https://${subdomain}.kommo.com/api/v4`;
    this.token = token;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Kommo API error ${response.status}: ${body}`
      );
    }

    return response.json();
  }

  async getLead(leadId: number): Promise<KommoLead> {
    const data = await this.request<{ _embedded: { leads: KommoLead[] } }>(
      `/leads/${leadId}?with=contacts`
    );
    return data._embedded.leads[0];
  }

  async getPipelines(): Promise<KommoPipeline[]> {
    const data = await this.request<{
      _embedded: { pipelines: KommoPipeline[] };
    }>("/leads/pipelines");
    return data._embedded.pipelines;
  }

  async getCustomFields(): Promise<
    Array<{ id: number; name: string; type: string; code: string | null }>
  > {
    const data = await this.request<{
      _embedded: {
        custom_fields: Array<{
          id: number;
          name: string;
          type: string;
          code: string | null;
        }>;
      };
    }>("/leads/custom_fields");
    return data._embedded.custom_fields;
  }
}

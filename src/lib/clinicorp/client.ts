import {
  ClinicorpPatient,
  ClinicorpProcedure,
  ClinicorpOAuthTokens,
  CreatePatientPayload,
} from "./types";

export class ClinicorpClient {
  private baseUrl = "https://sistema.clinicorp.com/api";
  private tokens: ClinicorpOAuthTokens;
  private clientId: string;
  private clientSecret: string;
  private onTokenRefresh?: (tokens: ClinicorpOAuthTokens) => Promise<void>;

  constructor(config: {
    tokens: ClinicorpOAuthTokens;
    clientId: string;
    clientSecret: string;
    onTokenRefresh?: (tokens: ClinicorpOAuthTokens) => Promise<void>;
  }) {
    this.tokens = config.tokens;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.onTokenRefresh = config.onTokenRefresh;
  }

  private async ensureValidToken(): Promise<string> {
    if (Date.now() < this.tokens.expiresAt - 60_000) {
      return this.tokens.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: this.tokens.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Clinicorp token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    if (this.onTokenRefresh) {
      await this.onTokenRefresh(this.tokens);
    }

    return this.tokens.accessToken;
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const token = await this.ensureValidToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Clinicorp API error ${response.status}: ${body}`);
    }

    return response.json();
  }

  async createPatient(
    payload: CreatePatientPayload
  ): Promise<ClinicorpPatient> {
    return this.request<ClinicorpPatient>("/patients", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async findPatientByPhone(phone: string): Promise<ClinicorpPatient | null> {
    try {
      const data = await this.request<{ data: ClinicorpPatient[] }>(
        `/patients?phone=${encodeURIComponent(phone)}`
      );
      return data.data.length > 0 ? data.data[0] : null;
    } catch {
      return null;
    }
  }

  async findPatientByCpf(cpf: string): Promise<ClinicorpPatient | null> {
    try {
      const data = await this.request<{ data: ClinicorpPatient[] }>(
        `/patients?cpf=${encodeURIComponent(cpf)}`
      );
      return data.data.length > 0 ? data.data[0] : null;
    } catch {
      return null;
    }
  }

  async getPatientProcedures(
    patientId: string
  ): Promise<ClinicorpProcedure[]> {
    const data = await this.request<{ data: ClinicorpProcedure[] }>(
      `/patients/${patientId}/procedures`
    );
    return data.data;
  }
}

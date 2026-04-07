import {
  ClinicorpPatient,
  ClinicorpBusiness,
  ClinicorpProfessional,
  ClinicorpAppointment,
  ClinicorpEstimate,
  CreatePatientPayload,
  CreateAppointmentPayload,
} from "./types";

export class ClinicorpClient {
  private baseUrl = "https://api.clinicorp.com/rest/v1";
  private authHeader: string;
  private subscriberId: string;

  constructor(config: { user: string; token: string; subscriberId?: string }) {
    const credentials = Buffer.from(`${config.user}:${config.token}`).toString(
      "base64"
    );
    this.authHeader = `Basic ${credentials}`;
    this.subscriberId = config.subscriberId ?? config.user;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
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

  // --- Patients ---

  async createPatient(
    payload: CreatePatientPayload
  ): Promise<ClinicorpPatient> {
    return this.request<ClinicorpPatient>("/patient/create", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async findPatient(params: {
    patientId?: string;
    name?: string;
    phone?: string;
    cpf?: string;
    email?: string;
  }): Promise<ClinicorpPatient | null> {
    const qs = new URLSearchParams({ subscriber_id: this.subscriberId });
    if (params.patientId) qs.set("PatientId", params.patientId);
    if (params.name) qs.set("Name", params.name);
    if (params.phone) qs.set("Phone", params.phone);
    if (params.cpf) qs.set("OtherDocumentId", params.cpf);
    if (params.email) qs.set("Email", params.email);

    try {
      const data = await this.request<ClinicorpPatient[]>(
        `/patient/get?${qs.toString()}`
      );
      return data.length > 0 ? data[0] : null;
    } catch {
      return null;
    }
  }

  // --- Appointments ---

  async createAppointment(
    payload: CreateAppointmentPayload
  ): Promise<ClinicorpAppointment> {
    return this.request<ClinicorpAppointment>(
      "/appointment/create_appointment_by_api",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  async listAppointments(params: {
    from: string;
    to: string;
    businessId: number;
    patientId?: string;
  }): Promise<ClinicorpAppointment[]> {
    const qs = new URLSearchParams({
      subscriber_id: this.subscriberId,
      from: params.from,
      to: params.to,
      businessId: String(params.businessId),
    });
    if (params.patientId) qs.set("patientId", params.patientId);

    return this.request<ClinicorpAppointment[]>(
      `/appointment/list?${qs.toString()}`
    );
  }

  // --- Estimates (Orçamentos/Procedimentos) ---

  async listEstimates(params: {
    from: string;
    to: string;
    clinicId?: string;
  }): Promise<ClinicorpEstimate[]> {
    const qs = new URLSearchParams({
      subscriber_id: this.subscriberId,
      from: params.from,
      to: params.to,
    });
    if (params.clinicId) qs.set("clinic_id", params.clinicId);

    return this.request<ClinicorpEstimate[]>(
      `/estimates/list?${qs.toString()}`
    );
  }

  // --- Business & Professionals ---

  async listBusinesses(): Promise<ClinicorpBusiness[]> {
    return this.request<ClinicorpBusiness[]>(
      `/business/list?subscriber_id=${this.subscriberId}`
    );
  }

  async listProfessionals(): Promise<ClinicorpProfessional[]> {
    return this.request<ClinicorpProfessional[]>(
      "/professional/list_all_professionals"
    );
  }
}

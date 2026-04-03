export interface ClinicorpPatient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  cpf?: string;
  tags?: string[];
  notes?: string;
}

export interface ClinicorpProcedure {
  id: string;
  patientId: string;
  name: string;
  value: number;
  status: string;
  completedAt?: string;
  createdAt: string;
}

export interface ClinicorpOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface CreatePatientPayload {
  name: string;
  phone?: string;
  email?: string;
  cpf?: string;
  tags?: string[];
  notes?: string;
}

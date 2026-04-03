export interface ClinicorpPatient {
  id: number;
  Name: string;
  Email?: string;
  MobilePhone?: string;
  DocumentId?: string;
  OtherDocumentId?: string;
  BirthDate?: string;
  Sex?: string;
  Notes?: string;
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

export interface ClinicorpBusiness {
  id: number;
  CompanyId: string;
  BusinessName: string;
  Name: string;
  Address: string;
  Email: string;
}

export interface ClinicorpProfessional {
  id: number;
  name: string;
  cpf: string;
}

export interface ClinicorpAppointment {
  id: number;
  PatientName: string;
  fromTime: string;
  toTime: string;
  date: string;
  status: string;
}

export interface CreatePatientPayload {
  subscriber_id: string;
  Name: string;
  BirthDate?: string;
  Sex?: string;
  Email?: string;
  MobilePhone?: number;
  DocumentId?: number;
  OtherDocumentId?: number;
  Notes?: string;
  IgnoreSameName?: string;
  IgnoreSameDoc?: string;
}

export interface CreateAppointmentPayload {
  Patient_PersonId: number;
  PatientName: string;
  MobilePhone?: string;
  Email?: string;
  fromTime: string;
  toTime: string;
  date: string;
  Clinic_BusinessId: number;
  Dentist_PersonId: number;
  ScheduleToId?: number;
  ScheduleToType?: string;
  Procedures?: string;
  CategoryColor?: string;
  CategoryDescription?: string;
}

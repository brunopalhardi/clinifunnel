export interface KommoLead {
  id: number;
  name: string;
  price: number;
  responsible_user_id: number;
  group_id: number;
  status_id: number;
  pipeline_id: number;
  loss_reason_id: number | null;
  created_by: number;
  updated_by: number;
  created_at: number;
  updated_at: number;
  closed_at: number | null;
  closest_task_at: number | null;
  is_deleted: boolean;
  custom_fields_values: KommoCustomField[] | null;
  account_id: number;
  _embedded?: {
    contacts?: KommoContact[];
    tags?: KommoTag[];
  };
}

export interface KommoCustomField {
  field_id: number;
  field_name: string;
  field_code: string | null;
  field_type: string;
  values: Array<{
    value: string;
    enum_id?: number;
    enum_code?: string;
  }>;
}

export interface KommoContact {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  custom_fields_values: KommoCustomField[] | null;
}

export interface KommoTag {
  id: number;
  name: string;
}

export interface KommoPipeline {
  id: number;
  name: string;
  sort: number;
  is_main: boolean;
  statuses: KommoStatus[];
  _embedded?: {
    statuses: KommoStatus[];
  };
}

export interface KommoStatus {
  id: number;
  name: string;
  sort: number;
  is_editable: boolean;
  pipeline_id: number;
  color: string;
  type: number;
}

export interface KommoWebhookPayload {
  leads?: {
    status?: Array<{
      id: string;
      status_id: string;
      pipeline_id: string;
      old_status_id: string;
      old_pipeline_id: string;
    }>;
    add?: Array<{
      id: string;
      status_id: string;
      pipeline_id: string;
    }>;
  };
  account?: {
    id: string;
    subdomain: string;
  };
}

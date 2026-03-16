export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  phone: string;
  role: 'admin' | 'manager';
  full_name: string;
  is_active: boolean;
}

export interface UserShort {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

export interface FederalDistrict {
  id: number;
  name: string;
  code: string;
  short_name: string;
}

export interface Region {
  id: number;
  name: string;
  code: string;
  federal_district: number;
  federal_district_name: string;
}

export interface Profession {
  id: number;
  number: number;
  name: string;
  demanded_regions_count: number;
}

export interface Program {
  id: number;
  name: string;
  profession: number;
  profession_name: string;
  profession_number: number;
  description: string;
  hours: number | null;
  is_active: boolean;
  contract_status: ContractStatusEntry[];
}

export interface ContractStatusEntry {
  contract_id: number;
  operator: number;
  operator_name: string;
  status: 'draft_appendix' | 'in_appendix' | 'approved';
  status_display: string;
}

export interface FederalOperator {
  id: number;
  name: string;
  short_name: string;
  description: string;
}

export interface Quota {
  id: number;
  federal_operator: number;
  federal_operator_name: string;
  program: number | null;
  program_name: string | null;
  region: number | null;
  region_name: string | null;
  year: number;
  total: number;
  used: number;
  available: number;
}

export interface Organization {
  id: number;
  name: string;
  short_name: string;
  inn: string;
  org_type: string;
  org_type_display: string;
  region: number | null;
  region_name: string | null;
  parent_organization: number | null;
  parent_organization_name: string | null;
  has_interaction_history: boolean;
  last_interaction_date: string | null;
  interactions_count: number;
}

export interface Campaign {
  id: number;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  status_display: string;
  federal_operator: number | null;
  federal_operator_name: string | null;
  hypothesis: string;
  hypothesis_result: string;
  created_by: number | null;
  created_by_name: string | null;
  total_demand: number;
  organizations_count: number;
  leads_count?: number;
  programs_count?: number;
  regions_count?: number;
  funnel_names?: string[];
  created_at: string;
  updated_at: string;
}

export interface CampaignDetail extends Campaign {
  queues: CampaignQueue[];
  campaign_funnels: CampaignFunnelEntry[];
  campaign_programs: CampaignProgram[];
  campaign_regions: CampaignRegion[];
  organizations: CampaignOrganization[];
  leads: Lead[];
}

export interface CampaignQueue {
  id: number;
  campaign: number;
  queue_number: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  stage_deadlines: QueueStageDeadline[];
}

export interface CampaignProgram {
  id: number;
  campaign: number;
  program: number;
  program_name: string;
  profession_name: string;
  manager: number | null;
  manager_name: string | null;
}

export interface CampaignRegion {
  id: number;
  campaign: number;
  region: number;
  region_name: string;
  federal_district_name: string;
  queue: number | null;
  queue_name: string | null;
  manager: number | null;
  manager_name: string | null;
}

export interface CampaignOrganization {
  id: number;
  campaign: number;
  organization: number;
  organization_name: string;
  organization_region: string | null;
  organization_type: string;
  status: string;
  status_display: string;
  manager: number | null;
  manager_name: string | null;
  demand_count: number;
  notes: string;
}

export interface DemandMatrix {
  regions: { id: number; name: string }[];
  professions: {
    profession_id: number;
    profession_number: number;
    profession_name: string;
    regions: Record<string, boolean>;
    approvals: Record<string, string | null>;
    region_missing_operators?: Record<string, { id: number; short_name: string }[]>;
  }[];
  year: number;
  federal_operators?: { id: number; short_name: string }[];
}

export interface ImportPreviewInvalidRegion {
  raw: string;
  normalized: string;
}

export interface ImportPreviewNewProfession {
  name: string;
  number: number | null;
  normalized: string;
}

export interface ImportPreviewSummary {
  created_professions: number;
  created_statuses: number;
  updated_statuses: number;
  skipped_rows: number;
  errors: string[];
  format: string;
}

export interface ImportPreviewResult {
  invalid_regions: ImportPreviewInvalidRegion[];
  new_professions: ImportPreviewNewProfession[];
  /** IDs профессий, которые уже есть в файле (для фильтра «заменить на» — только не из файла) */
  existing_profession_ids_in_file?: number[];
  preview: ImportPreviewSummary;
}

export interface ImportApplyResult {
  created_professions: number;
  created_statuses: number;
  updated_statuses: number;
  skipped_rows: number;
  errors_count: number;
  errors: string[];
  format: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Funnels

export interface ChecklistItemOption {
  id: number;
  checklist_item: number;
  value: string;
  order: number;
}

export interface StageChecklistItem {
  id: number;
  stage: number;
  text: string;
  order: number;
  confirmation_type: 'none' | 'text' | 'file' | 'select' | 'contact';
  confirmation_type_display: string;
  options: ChecklistItemOption[];
}

export interface FunnelStage {
  id: number;
  funnel: number;
  name: string;
  order: number;
  deadline_days: number;
  is_rejection: boolean;
  checklist_items: StageChecklistItem[];
}

export interface Funnel {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  stages_count?: number;
  created_at: string;
  updated_at: string;
}

export interface FunnelDetail extends Funnel {
  stages: FunnelStage[];
}

// Leads

export interface Contact {
  id: number;
  organization: number;
  organization_name: string;
  type: 'person' | 'department' | 'main' | 'other';
  type_display: string;
  comment: string;
  current: boolean;
  first_name: string;
  last_name: string;
  middle_name: string;
  position: string;
  phone: string;
  email: string;
  messenger: string;
  is_manager: boolean;
  department_name: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface LeadChecklistValue {
  id: number;
  lead: number;
  checklist_item: number;
  checklist_item_text: string;
  confirmation_type: string;
  stage_id: number;
  options: string[];
  is_completed: boolean;
  text_value: string;
  file_value: string | null;
  select_value: string;
  contact: number | null;
  contact_full_name: string | null;
  contact_name: string;
  contact_position: string;
  contact_phone: string;
  contact_email: string;
  contact_messenger: string;
  completed_at: string | null;
  completed_by: number | null;
}

export interface LeadInteraction {
  id: number;
  lead: number;
  contact: number | null;
  contact_full_name: string | null;
  contact_person: string;
  contact_position: string;
  contact_position_from_ref: string | null;
  date: string;
  channel: string;
  channel_display: string;
  result: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface LeadStageDeadline {
  stage_id: number;
  stage_name: string;
  order: number;
  deadline_days: number;
  deadline_date: string | null;
  is_rejection: boolean;
}

export interface Lead {
  id: number;
  campaign: number;
  organization: number;
  organization_name: string;
  organization_region: string | null;
  funnel: number;
  funnel_name: string;
  queue: number | null;
  queue_name: string | null;
  current_stage: number | null;
  current_stage_name: string | null;
  current_stage_is_rejection: boolean;
  manager: number | null;
  manager_name: string | null;
  forecast_demand: number | null;
  demand_count: number;
  notes: string;
  checklist_progress: { total: number; completed: number } | null;
  checklist_summary: { text: string; done: boolean }[];
  last_interaction: {
    contact_person: string;
    date: string | null;
    channel: string;
    result: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface LeadDetail extends Lead {
  checklist_values: LeadChecklistValue[];
  interactions: LeadInteraction[];
  stage_deadlines: LeadStageDeadline[];
}

// External organizations (Bitrix API)

export interface ExternalOrganization {
  name: string;
  full_name: string;
  type: string;
  region: string;
  federal_company: boolean;
  fed_district: string;
  prof_activity: string;
  projects: { name: string }[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExternalFedDistrict {
  name: string;
  region: { name: string }[];
}

export interface ExternalOrgType {
  name: string;
}

// Campaign Funnel

export interface CampaignFunnelEntry {
  id: number;
  campaign: number;
  funnel: number;
  funnel_name: string;
}

export interface QueueStageDeadline {
  id: number;
  queue: number;
  funnel_stage: number;
  stage_name: string;
  deadline_days: number;
}

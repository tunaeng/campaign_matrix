export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  phone: string;
  role: 'admin' | 'manager' | 'specialist';
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
  inn: string | null;
  org_type: string;
  org_type_display: string;
  region: number | null;
  region_name: string | null;
  parent_organization: number | null;
  parent_organization_name: string | null;
  parent_organization_short_name?: string | null;
  is_our_side: boolean;
  description: string;
  tags?: number[];
  tag_names?: string[];
  has_interaction_history: boolean;
  last_interaction_date: string | null;
  interactions_count: number;
  can_delete?: boolean;
  deletion_block_reasons?: string[];
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_phone_extension?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ImportBatch {
  id: number;
  entity_type: 'organizations' | 'contacts';
  entity_type_display: string;
  file_name: string;
  uploaded_by: number | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  total_rows: number;
  status: 'completed' | 'rolled_back';
  status_display: string;
  rolled_back_at: string | null;
  can_rollback: boolean;
}

export interface ImportBatchRollbackResult {
  deleted: number;
  reverted: number;
  skipped: number;
  errors?: string[];
}

export interface OrganizationTag {
  id: number;
  name: string;
  slug: string;
  color: string;
  tag_type: 'all' | 'organizations' | 'contacts' | 'funnels' | 'campaigns' | 'leads';
  tag_type_display?: string;
  category?: string;
}

export interface ProjectMembership {
  id: number;
  project: number;
  organization: number;
  organization_name: string;
  role: 'customer' | 'federal_operator' | 'participant' | 'contractor' | 'implementer';
  role_display: string;
  notes: string;
  sort_order: number;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  year: number;
  code: string;
  memberships: ProjectMembership[];
  created_at: string;
  updated_at: string;
}

export interface ActingOrganization {
  id: number;
  user: number;
  organization: number;
  organization_name: string;
  organization_inn: string;
  is_primary: boolean;
  created_at: string;
}

/** Сводка потребности по лидам кампании (суммы) */
export interface CampaignDemandSummary {
  plan: number;
  declared_collected: number;
  declared_quota: number;
  list_collected: number;
  list_quota: number;
}

export interface Campaign {
  id: number;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  status_display: string;
  /** Операционная стадия кампании (не путать со стадией воронки лида) */
  operational_stage?: '' | 'organization_list';
  operational_stage_display?: string;
  federal_operator: number | null;
  federal_operator_name: string | null;
  /** Сокращённое название ФО (поле short_name организации) */
  federal_operator_short_name?: string | null;
  federal_operators?: number[];
  federal_operator_names?: string[];
  project: number | null;
  project_name: string | null;
  acting_organization: number | null;
  acting_organization_name: string | null;
  hypothesis: string;
  hypothesis_result: string;
  collect_search_task?: string;
  created_by: number | null;
  created_by_name: string | null;
  responsible: number | null;
  responsible_name: string | null;
  total_demand: number;
  organizations_count: number;
  leads_count?: number;
  programs_count?: number;
  regions_count?: number;
  funnel_names?: string[];
  /** Минимальная дата начала среди очередей кампании */
  queue_period_start?: string | null;
  /** Максимальная дата окончания (по этапам воронки) */
  queue_period_end?: string | null;
  /** Периоды по очередям */
  queue_periods?: { name: string; queue_number: number; start_date: string; end_date: string | null }[];
  demand_summary?: CampaignDemandSummary;
  tags?: number[];
  tag_names?: string[];
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
  primary_contact_specialist?: number | null;
  primary_contact_specialist_name?: string | null;
  demand_quota?: number;
  search_task?: string;
}

/** Снимок основного контакта лида (API) */
export interface LeadPrimaryContactBrief {
  id: number;
  full_name: string;
  type: string;
  type_display: string;
  position: string;
  phone: string;
  email: string;
  department_name: string;
  messenger: string;
  comment: string;
}

/** Превью лида с основным контактом по строке заказчика в кампании */
export interface LeadPrimaryContactOrgPreview {
  lead_id: number;
  funnel_name: string | null;
  contact: LeadPrimaryContactBrief;
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
  primary_contact_preview?: LeadPrimaryContactOrgPreview | null;
  /** Теги организации-участника кампании */
  organization_tags?: number[];
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
    demand_history?: Record<string, {
      id: number;
      source?: string;
      demand_import_id?: number;
      federal_operator_id: number | null;
      federal_operator_name: string;
      previous_is_demanded: boolean | null;
      new_is_demanded: boolean;
      changed_at: string;
    }[]>;
  }[];
  year: number;
  federal_operators?: { id: number; short_name: string }[];
  demand_imports?: {
    id: number;
    federal_operator_id: number;
    federal_operator_name: string;
    imported_at: string;
    snapshot_count: number;
  }[];
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
  confirmation_types: ('text' | 'file' | 'select' | 'contact')[];
  confirmation_types_display: string[];
  primary_contact_specialist?: number | null;
  primary_contact_specialist_name?: string | null;
  communication_step?: '' | 'email_prepared' | 'email_sent' | 'response_received' | 'result_recorded';
  communication_step_display?: string;
  options: ChecklistItemOption[];
}

export interface FunnelStage {
  id: number;
  funnel: number;
  name: string;
  order: number;
  deadline_days: number;
  is_rejection: boolean;
  responsible_role?: 'manager' | 'primary_contact_specialist';
  is_collect_stage?: boolean;
  selection_mode?: '' | 'regions';
  search_task?: string;
  primary_contact_specialist?: number | null;
  primary_contact_specialist_name?: string | null;
  checklist_items: StageChecklistItem[];
}

export interface Funnel {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  tags?: number[];
  tag_names?: string[];
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
  phone_extension?: string;
  email: string;
  messenger: string;
  is_manager: boolean;
  department_name: string;
  full_name: string;
  tags?: number[];
  tag_names?: string[];
  bitrix_contact_id: number | null;
  can_delete?: boolean;
  deletion_block_reasons?: string[];
  created_at: string;
  updated_at: string;
}

export interface EntityFieldChange {
  id: number;
  organization: number | null;
  organization_name: string | null;
  contact: number | null;
  contact_name: string | null;
  field_name: string;
  old_value: string;
  new_value: string;
  source: "manual" | "bulk" | "sync";
  source_display: string;
  changed_by: number | null;
  changed_by_name: string | null;
  changed_at: string;
}

export interface LeadChecklistFile {
  id: number | null;
  url: string;
  filename: string;
  order: number;
}

export interface LeadChecklistValue {
  id: number;
  lead: number;
  checklist_item: number;
  checklist_item_text: string;
  confirmation_types: string[];
  confirmation_types_display: string[];
  stage_id: number;
  options: string[];
  is_completed: boolean;
  text_value: string;
  /** Список вложений; приоритет над file_value */
  files?: LeadChecklistFile[];
  /** Первый файл (совместимость) */
  file_value: string | null;
  select_value: string;
  contact: number | null;
  contact_full_name: string | null;
  contact_name: string;
  contact_position: string;
  contact_phone: string;
  contact_email: string;
  contact_messenger: string;
  primary_contact_specialist?: number | null;
  primary_contact_specialist_name?: string | null;
  communication_step?: '' | 'email_prepared' | 'email_sent' | 'response_received' | 'result_recorded';
  communication_step_display?: string;
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

/** Элемент GET /leads/:id/timeline/ — взаимодействия, смена стадий, чек-лист */
export type LeadTimelineItem =
  | {
      kind: 'interaction';
      id: number;
      at: string;
      data: LeadInteraction;
    }
  | {
      kind: 'stage';
      id: number;
      at: string;
      summary: string;
      created_by_name: string | null;
    }
  | {
      kind: 'checklist';
      id: number;
      at: string;
      summary: string;
      created_by_name: string | null;
      /** Для фильтра по контакту: пункт чек-листа с выбором из справочника */
      contact_id?: number | null;
    };

export interface LeadStageDeadline {
  stage_id: number;
  stage_name: string;
  order: number;
  deadline_days: number;
  deadline_date: string | null;
  is_rejection: boolean;
  is_collect_stage?: boolean;
}

export interface Lead {
  id: number;
  campaign: number;
  organization: number;
  organization_name: string;
  region: number | null;
  region_name?: string | null;
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
  primary_contact_specialist?: number | null;
  primary_contact_specialist_name?: string | null;
  primary_contact_status?: 'new' | 'email_prepared' | 'email_sent' | 'response_received' | 'result_recorded' | 'rejected';
  primary_contact_result?: string;
  forecast_demand: number | null;
  demand_count: number;
  demand_collected_declared?: number;
  demand_collected_list?: number;
  demand_quota_declared?: number;
  demand_quota_list?: number;
  notes: string;
  forwarded_from?: string | null;
  checklist_progress: { total: number; completed: number } | null;
  checklist_summary: { text: string; done: boolean }[];
  tasks_summary?: LeadTaskSummary[];
  last_interaction: {
    contact_person: string;
    date: string | null;
    channel: string;
    result: string;
  } | null;
  /** Основной контакт организации: не больше одного лида на организацию */
  primary_contact?: LeadPrimaryContactBrief | null;
  tags?: number[];
  /** Теги связанной организации (для фильтров и отображения) */
  organization_tags?: number[];
  tag_names?: string[];
  created_at: string;
  updated_at: string;
}

export interface LeadDetail extends Lead {
  checklist_values: LeadChecklistValue[];
  interactions: LeadInteraction[];
  stage_deadlines: LeadStageDeadline[];
  subfunnels?: LeadSubfunnel[];
}

// External organizations (Bitrix API)

export interface ExternalOrganization {
  id?: number;
  name: string;
  full_name: string;
  type: string;
  region: string;
  region_id?: number | null;
  federal_company: boolean;
  fed_district: string;
  prof_activity: string;
  projects: { name: string }[];
  is_active: boolean;
  /** Признак «наша организация» в Bitrix (если отдаёт API) */
  is_our_side?: boolean;
  inn?: string | null;
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

export interface ExternalContact {
  id?: number;
  type: 'person' | 'department' | 'main' | 'other';
  comment: string;
  current: boolean;
  organization: string; // INN
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  position?: string;
  first_name_dat?: string;
  last_name_dat?: string;
  middle_name_dat?: string;
  position_dat?: string;
  manager?: boolean;
  department_name?: string;
}

export interface ExternalContactHistoryRecord extends ExternalContact {
  history_id: number;
  history_date: string;
  history_type: '+' | '~' | '-';
  history_user: string | null;
}

export interface ExternalCommunicationContact {
  id: number;
  fio: string | null;
  position: string | null;
}

export interface ExternalCommunication {
  id: number;
  counterparty_organization: string;
  counterparty_organization_name: string;
  counterparty_contact: ExternalCommunicationContact | null;
  our_organization: string;
  our_organization_name: string;
  channel: string;
  channel_display: string;
  occurred_at: string;
  result: string;
  project: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalCommunicationPayload {
  counterparty_organization: string;
  counterparty_contact?: number | null;
  our_organization: string;
  channel: string;
  occurred_at: string;
  result: string;
  project?: string | null;
}

/** Ответ POST /external-contacts/sync-user/ — контакт на каждый ИНН */
export interface SyncUserAsOurSideContactResultItem {
  organization_inn: string;
  ok: boolean;
  status_code?: number;
  external_contact?: unknown;
  upstream_payload?: unknown;
  detail?: string;
  /** Локальный Contact в Matrix (если есть Organization с этим ИНН и sync_local) */
  local_contact?: Contact | null;
  /** ok | no_local_org | off */
  local_sync?: string;
}

export interface SyncUserAsOurSideContactResponse {
  user_id: number;
  organization_inns: string[];
  results: SyncUserAsOurSideContactResultItem[];
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

export interface WorkloadDashboardRow {
  user_id: number;
  user_name: string;
  role: 'manager' | 'specialist';
  active_leads: number;
  pending_checklist: number;
  overdue_stage: number;
  overdue_checklist: number;
  tasks_in_progress: number;
  tasks_overdue: number;
}

export interface WorkloadDashboardManagerLead {
  lead_id: number;
  organization_name: string;
  stage_name: string | null;
  stage_deadline: string | null;
  stage_overdue: boolean;
  pending_checklist: number;
  overdue_checklist: number;
}

export interface WorkloadDashboardManagerCampaign {
  campaign_id: number;
  campaign_name: string;
  leads: WorkloadDashboardManagerLead[];
}

export interface WorkloadDashboardManager {
  user_id: number;
  user_name: string;
  campaigns: WorkloadDashboardManagerCampaign[];
}

export type TaskWorkflowStatus = 'backlog' | 'in_progress' | 'paused' | 'rejected' | 'done';

export interface WorkloadDashboardTaskStats {
  total: number;
  backlog: number;
  in_progress: number;
  paused: number;
  rejected: number;
  done: number;
  overdue: number;
}

export interface WorkloadDashboardSpecialistTemplate {
  template_id: number;
  template_name: string;
  stats: WorkloadDashboardTaskStats;
}

/** Задача в блоке специалиста (устаревший формат API до агрегированных stats). */
export interface WorkloadDashboardSpecialistTask {
  id: number;
  status: string;
  is_overdue?: boolean;
}

export interface WorkloadDashboardSpecialistCampaign {
  campaign_id: number;
  campaign_name: string;
  stats?: WorkloadDashboardTaskStats | null;
  templates?: WorkloadDashboardSpecialistTemplate[];
  /** Список задач — если API ещё не отдаёт stats. */
  tasks?: WorkloadDashboardSpecialistTask[];
}

export interface WorkloadDashboardSpecialist {
  user_id: number;
  user_name: string;
  campaigns: WorkloadDashboardSpecialistCampaign[];
  overdue_total?: number;
}

export interface WorkloadDashboardChartsPoint {
  campaign_id?: number;
  campaign_name?: string;
  user_id?: number;
  user_name?: string;
  date?: string;
  backlog?: number;
  in_progress?: number;
  paused?: number;
  rejected?: number;
  done?: number;
  overdue?: number;
  done_in_period?: number;
  opened?: number;
  completed?: number;
}

export interface WorkloadDashboardCharts {
  scope: 'manager' | 'specialist';
  by_campaign: WorkloadDashboardChartsPoint[];
  by_user: WorkloadDashboardChartsPoint[];
  by_day: WorkloadDashboardChartsPoint[];
  status_pie: Array<{
    status: string;
    count: number;
  }>;
}

export interface WorkloadDashboardResponse {
  rows: WorkloadDashboardRow[];
  totals: {
    active_leads: number;
    pending_checklist: number;
    overdue_stage: number;
    overdue_checklist: number;
    tasks_in_progress: number;
    tasks_overdue: number;
  };
  managers: WorkloadDashboardManager[];
  specialists: WorkloadDashboardSpecialist[];
  charts: WorkloadDashboardCharts;
  meta: {
    role: 'all' | 'manager' | 'specialist';
    campaign: number | null;
    funnel: number | null;
    user: number | null;
    date_from: string | null;
    date_to: string | null;
    period_mode: 'activity';
  };
}

export interface RoleDefinition {
  id: number;
  code: string;
  name: string;
  description: string;
  scope_type: 'global' | 'campaign' | 'funnel' | 'subfunnel';
  is_active: boolean;
  is_system: boolean;
}

export interface UserRoleAssignment {
  id: number;
  user: number;
  user_name: string;
  role: number;
  role_name: string;
  scope_type: 'global' | 'campaign' | 'funnel' | 'subfunnel';
  scope_id: number | null;
  is_primary: boolean;
}

export interface SubfunnelTemplateItem {
  id: number;
  template: number;
  title: string;
  order: number;
  execution_type: 'stage' | 'checklist_item' | 'stage_range_checklist';
  stage: number | null;
  stage_name?: string | null;
  default_role: number | null;
  default_role_name?: string | null;
  default_specialist: number | null;
  default_specialist_name?: string | null;
}

export interface TaskTemplateStage {
  id: number;
  template: number;
  name: string;
  order: number;
  is_work_stage: boolean;
  is_active: boolean;
  task_status: 'backlog' | 'in_progress' | 'paused' | 'rejected' | 'done';
  is_terminal: boolean;
  sla_days: number;
}

export interface SubfunnelTemplate {
  id: number;
  name: string;
  slug: string;
  description: string;
  owner_role: number | null;
  owner_role_name?: string | null;
  is_active: boolean;
  auto_create_on_collect_import: boolean;
  advance_lead_on_task_stage_forward: boolean;
  version: number;
  stages: TaskTemplateStage[];
  items: SubfunnelTemplateItem[];
}

export interface SubfunnelTemplateBinding {
  id: number;
  funnel: number;
  template: number;
  template_name: string;
  binding_type: 'stage' | 'checklist_item' | 'stage_range_checklist';
  target_stage: number | null;
  target_checklist_item: number | null;
  from_stage: number | null;
  to_stage: number | null;
  role: number | null;
  role_name?: string | null;
  default_specialist: number | null;
  default_specialist_name?: string | null;
  is_active: boolean;
  advance_lead_on_task_stage_forward?: boolean;
}

export interface CampaignSubfunnel {
  id: number;
  campaign: number;
  funnel: number;
  template: number;
  template_name: string;
  binding: number | null;
  role: number | null;
  role_name?: string | null;
  default_assignee: number | null;
  default_assignee_name?: string | null;
  template_version: number;
  is_active: boolean;
}

export interface LeadSubfunnelChecklistValue {
  id: number;
  lead_subfunnel: number;
  template_item: number;
  template_item_title: string;
  template_item_order: number;
  template_item_stage_id?: number | null;
  template_item_stage_name?: string | null;
  is_completed: boolean;
  text_value: string;
  assignee: number | null;
  assignee_name?: string | null;
  completed_at: string | null;
  completed_by: number | null;
  completed_by_name?: string | null;
}

export interface LeadTaskSummary {
  id: number;
  template_name: string;
  stage_name: string | null;
  status: TaskWorkflowStatus | 'todo' | 'blocked';
  done: boolean;
  progress: { total: number; completed: number };
}

export interface LeadSubfunnel {
  id: number;
  lead: number | null;
  campaign_subfunnel: number;
  campaign_region?: number | null;
  campaign_region_id?: number | null;
  region_id?: number | null;
  region_name?: string | null;
  is_region_task?: boolean;
  display_name?: string | null;
  template_id: number;
  template_name: string;
  role_id: number | null;
  role_name?: string | null;
  status: TaskWorkflowStatus | 'todo' | 'blocked';
  current_template_stage: number | null;
  current_template_stage_name?: string | null;
  current_template_stage_order?: number | null;
  can_advance_stage?: boolean;
  can_retreat_stage?: boolean;
  assignee: number | null;
  assignee_name?: string | null;
  due_at: string | null;
  completed_at: string | null;
  is_available: boolean;
  checklist_values: LeadSubfunnelChecklistValue[];
  forwarded_from?: string | null;
}

export interface SubfunnelWorkspaceItem {
  id: number;
  campaign_id: number;
  campaign_name: string;
  lead_id: number | null;
  lead_name: string;
  forwarded_from?: string | null;
  is_region_task?: boolean;
  campaign_region_id?: number | null;
  region_id?: number | null;
  region_name?: string | null;
  stage_name: string | null;
  template_id: number;
  template_name: string;
  role_id: number | null;
  role_name: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  status: TaskWorkflowStatus | 'todo' | 'blocked';
  current_template_stage_id?: number | null;
  current_template_stage_name?: string | null;
  current_template_stage_order?: number | null;
  board_stage_key?: string;
  due_at: string | null;
  is_overdue: boolean;
  is_available: boolean;
  checklist_progress?: { total: number; completed: number };
  checklist_summary?: { text: string; done: boolean }[];
  show_capture_counts?: boolean;
  capture_counts?: { organizations: number; contacts: number } | null;
}

export interface CampaignCollectStageImportResult {
  leads_created: number;
  organizations_linked: number;
  leads_by_region?: Record<string, number>;
  errors: string[];
  organizations_import?: { created: number; updated: number; skipped: number; errors?: string[] };
  contacts_import?: { created: number; updated: number; skipped: number; errors?: string[] };
}

export interface OrganizationListCaptureResult {
  results: Array<{
    organization_id: number;
    organization_name: string;
    contact_id: number | null;
    lead_id: number | null;
    created: boolean;
  }>;
  summary: {
    created: number;
    skipped: number;
    errors: string[];
  };
}

export interface RegionTaskCaptureLeadItem {
  lead_id: number;
  organization_id: number;
  organization_name: string | null;
  primary_contact: string | null;
  created_at: string | null;
}

export interface RegionTaskCaptureSummary {
  campaign_region_id: number;
  region_id: number;
  region_name: string | null;
  demand_quota: number;
  leads_count: number;
  organizations: RegionTaskCaptureLeadItem[];
}

export interface LeadSubfunnelBulkUpdateResult {
  updated: number;
  requested: number;
  skipped: Array<{ id: number; reason: string }>;
}

export interface LeadSubfunnelBulkChecklistResult {
  updated_tasks: number;
  updated_values: number;
  requested: number;
  skipped: Array<{ id: number; reason: string }>;
}

export interface BulkActionResult {
  updated?: number;
  deleted?: number;
  requested: number;
  skipped?: Array<{ id: number; reason: string }>;
}

export interface SubfunnelWorkspaceResponse {
  view_mode: 'kanban' | 'table';
  templates: Array<{
    id: number;
    name: string;
    count: number;
  }>;
  active_template_id: number | null;
  columns: Array<{
    status: string;
    stage_id?: number | null;
    stage_name: string;
    order: number;
    is_work_stage?: boolean;
  }>;
  items_by_stage: Record<string, SubfunnelWorkspaceItem[]>;
  kanban: Array<{ status: string; stage_id?: number | null; stage_name?: string | null; items: SubfunnelWorkspaceItem[] }>;
  table: SubfunnelWorkspaceItem[];
  totals: {
    all: number;
    overdue: number;
    backlog: number;
    in_progress: number;
    paused: number;
    rejected: number;
    done: number;
  };
}

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import client from './client';
import type {
  PaginatedResponse, Campaign, CampaignDetail,
  Region, FederalDistrict, Profession, Program,
  FederalOperator, Organization, OrganizationTag, Project, ActingOrganization, Quota, DemandMatrix, UserShort,
  Funnel, FunnelDetail, FunnelStage, StageChecklistItem, ChecklistItemOption, Contact, EntityFieldChange, WorkloadDashboardResponse,
  RoleDefinition, UserRoleAssignment, SubfunnelTemplate, SubfunnelTemplateBinding, CampaignSubfunnel,
  LeadSubfunnel, LeadSubfunnelBulkUpdateResult, LeadSubfunnelBulkChecklistResult, CampaignCollectStageImportResult,
  OrganizationListCaptureResult, RegionTaskCaptureSummary,
  SubfunnelWorkspaceResponse, TaskTemplateStage, SubfunnelTemplateItem,
} from '../types';

/** Второй сегмент ключа всегда string: из URL (useParams) и из API (number) иначе не сходятся при invalidate. */
function campaignDetailQueryKey(id: number | string | null | undefined) {
  if (id === undefined || id === null || id === '') return ['campaign', ''] as const;
  return ['campaign', String(id)] as const;
}

// Auth
export function useMe() {
  return useQuery<import('../types').User>({
    queryKey: ['me'],
    queryFn: () => client.get('/auth/me/').then(r => r.data),
    retry: false,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (creds: { username: string; password: string }) =>
      client.post('/auth/login/', creds).then(r => r.data),
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
    },
  });
}

// Users
export function useUsers() {
  return useQuery<PaginatedResponse<UserShort>>({
    queryKey: ['users'],
    queryFn: () => client.get('/auth/users/').then(r => r.data),
  });
}

export function useRoles(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<RoleDefinition>>({
    queryKey: ['roles', params],
    queryFn: () => client.get('/auth/roles/', { params }).then(r => r.data),
    staleTime: 300_000,
  });
}

export function useRoleAssignments(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<UserRoleAssignment>>({
    queryKey: ['role-assignments', params],
    queryFn: () => client.get('/auth/role-assignments/', { params }).then(r => r.data),
  });
}

// Reference data
export function useFederalDistricts() {
  return useQuery<PaginatedResponse<FederalDistrict>>({
    queryKey: ['federal-districts'],
    queryFn: () => client.get('/federal-districts/').then(r => r.data),
    staleTime: 600_000,
  });
}

export function useRegions(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<Region>>({
    queryKey: ['regions', params],
    queryFn: () => client.get('/regions/', { params: { ...params, page_size: 200 } }).then(r => r.data),
    staleTime: 600_000,
  });
}

export function useProfessions(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<Profession>>({
    queryKey: ['professions', params],
    queryFn: () => client.get('/professions/', { params: { ...params, page_size: 300 } }).then(r => r.data),
    staleTime: 600_000,
  });
}

export function usePrograms(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<Program>>({
    queryKey: ['programs', params],
    queryFn: () => client.get('/programs/', { params: { ...params, page_size: 200 } }).then(r => r.data),
  });
}

export function useFederalOperators(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<FederalOperator>>({
    queryKey: ['federal-operators', params],
    queryFn: () => client.get('/federal-operators/', { params }).then(r => r.data),
    staleTime: 600_000,
  });
}

export function useOrganizations(params?: Record<string, any>) {
  const merged =
    params?.page != null || params?.page_size != null
      ? { ...(params ?? {}) }
      : { page_size: 500, ...(params ?? {}) };
  const paginated = params?.page != null || params?.page_size != null;
  return useQuery<PaginatedResponse<Organization>>({
    queryKey: ['organizations', merged],
    queryFn: () => client.get('/organizations/', { params: merged }).then((r) => r.data),
    placeholderData: paginated ? keepPreviousData : undefined,
  });
}

export function useOrganizationTags(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<OrganizationTag>>({
    queryKey: ['organization-tags', params],
    queryFn: () => client.get('/organization-tags/', { params }).then(r => r.data),
    staleTime: 300_000,
  });
}

export function useCreateOrganizationTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<OrganizationTag>) =>
      client.post('/organization-tags/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization-tags'] }),
  });
}

export function usePatchOrganizationTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<OrganizationTag>) =>
      client.patch(`/organization-tags/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization-tags'] }),
  });
}

export function useDeleteOrganizationTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => client.delete(`/organization-tags/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization-tags'] }),
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Organization>) => client.post('/organizations/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Organization>) =>
      client.patch(`/organizations/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}

export function useProjects(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<Project>>({
    queryKey: ['projects', params],
    queryFn: () => client.get('/projects/', { params }).then(r => r.data),
    staleTime: 300_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Project>) =>
      client.post('/projects/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['communication-history'] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Project>) =>
      client.patch(`/projects/${id}/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['communication-history'] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => client.delete(`/projects/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['communication-history'] });
    },
  });
}

export function useProjectMemberships(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<import('../types').ProjectMembership>>({
    queryKey: ['project-memberships', params],
    queryFn: () => client.get('/project-memberships/', { params: { page_size: 1000, ...(params ?? {}) } }).then(r => r.data),
  });
}

export function useCreateProjectMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<import('../types').ProjectMembership>) =>
      client.post('/project-memberships/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-memberships'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useUpdateProjectMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<import('../types').ProjectMembership>) =>
      client.patch(`/project-memberships/${id}/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-memberships'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useDeleteProjectMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => client.delete(`/project-memberships/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-memberships'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useActingOrganizations() {
  return useQuery<PaginatedResponse<ActingOrganization>>({
    queryKey: ['acting-organizations'],
    queryFn: () => client.get('/acting-organizations/').then(r => r.data),
  });
}

export function useMyActingOrganizations() {
  return useQuery<ActingOrganization[]>({
    queryKey: ['me-acting-organizations'],
    queryFn: () => client.get('/me/acting-organizations/').then(r => r.data),
  });
}

export function useCommunicationHistory(params?: Record<string, any>) {
  return useQuery<any[]>({
    queryKey: ['communication-history', params],
    queryFn: () => client.get('/communication-history/', { params }).then(r => r.data),
  });
}

export function useQuotas(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<Quota>>({
    queryKey: ['quotas', params],
    queryFn: () => client.get('/quotas/', { params }).then(r => r.data),
  });
}

export function useDemandMatrix(params?: Record<string, any>) {
  return useQuery<DemandMatrix>({
    queryKey: ['demand-matrix', params],
    queryFn: () => client.get('/demand-matrix/', { params }).then(r => r.data),
  });
}

export function useImportDemandMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) =>
      client
        .post('/demand-matrix/import/', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['demand-matrix'] });
      qc.invalidateQueries({ queryKey: ['professions'] });
    },
  });
}

export function useImportDemandMatrixPreview() {
  return useMutation<import('../types').ImportPreviewResult, unknown, FormData>({
    mutationFn: (data: FormData) =>
      client
        .post('/demand-matrix/import/preview/', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(r => r.data),
  });
}

export function useImportDemandMatrixApply() {
  const qc = useQueryClient();
  return useMutation<import('../types').ImportApplyResult, unknown, FormData>({
    mutationFn: (data: FormData) =>
      client
        .post('/demand-matrix/import/apply/', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['demand-matrix'] });
      qc.invalidateQueries({ queryKey: ['professions'] });
    },
  });
}

// Funnels
export function useFunnels(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<Funnel>>({
    queryKey: ['funnels', params],
    queryFn: () => client.get('/funnels/', { params: { ...params, page_size: 100 } }).then(r => r.data),
    staleTime: 300_000,
  });
}

export function useFunnel(id: number | string) {
  return useQuery<FunnelDetail>({
    queryKey: ['funnel', id],
    queryFn: () => client.get(`/funnels/${id}/`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateFunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; tags?: number[] }) =>
      client.post('/funnels/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnels'] }),
  });
}

export function useUpdateFunnel(id: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => client.patch(`/funnels/${id}/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funnels'] });
      qc.invalidateQueries({ queryKey: ['funnel', id] });
    },
  });
}

export function useDeleteFunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => client.delete(`/funnels/${id}/`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnels'] }),
  });
}

export function useCreateFunnelStage(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      order: number;
      deadline_days: number;
      responsible_role?: 'manager' | 'primary_contact_specialist';
      is_collect_stage?: boolean;
      selection_mode?: '' | 'regions';
      search_task?: string;
      primary_contact_specialist?: number | null;
    }) =>
      client.post(`/funnels/${funnelId}/stages/`, { ...data, funnel: funnelId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnel', funnelId] }),
  });
}

export function useUpdateFunnelStage(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, ...data }: { stageId: number } & Partial<FunnelStage>) =>
      client.patch(`/funnel-stages/${stageId}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnel', funnelId] }),
  });
}

export function useDeleteFunnelStage(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stageId: number) => client.delete(`/funnel-stages/${stageId}/`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnel', funnelId] }),
  });
}

export function useCreateChecklistItem(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      stage: number;
      text: string;
      order: number;
      confirmation_types: string[];
      primary_contact_specialist?: number | null;
      communication_step?: '' | 'email_prepared' | 'email_sent' | 'response_received' | 'result_recorded';
    }) =>
      client.post('/checklist-items/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnel', funnelId] }),
  });
}

export function useUpdateChecklistItem(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...data }: { itemId: number } & Partial<StageChecklistItem>) =>
      client.patch(`/checklist-items/${itemId}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnel', funnelId] }),
  });
}

export function useDeleteChecklistItem(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => client.delete(`/checklist-items/${itemId}/`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnel', funnelId] }),
  });
}

export function useCreateChecklistOption(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { checklist_item: number; value: string; order: number }) =>
      client.post('/checklist-options/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnel', funnelId] }),
  });
}

export function useDeleteChecklistOption(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optionId: number) =>
      client.delete(`/checklist-options/${optionId}/`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnel', funnelId] }),
  });
}

export function useSubfunnelTemplates(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<SubfunnelTemplate>>({
    queryKey: ['subfunnel-templates', params],
    queryFn: () => client.get('/subfunnel-templates/', { params }).then(r => r.data),
  });
}

export function useCreateSubfunnelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SubfunnelTemplate>) =>
      client.post('/subfunnel-templates/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subfunnel-templates'] });
    },
  });
}

export function usePatchSubfunnelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<SubfunnelTemplate>) =>
      client.patch(`/subfunnel-templates/${id}/`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subfunnel-templates'] });
    },
  });
}

export function useDeleteSubfunnelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => client.delete(`/subfunnel-templates/${id}/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subfunnel-templates'] });
      qc.invalidateQueries({ queryKey: ['task-template-stages'] });
      qc.invalidateQueries({ queryKey: ['subfunnel-template-items'] });
    },
  });
}

export function useTaskTemplateStages(templateId?: number | string) {
  return useQuery<TaskTemplateStage[]>({
    queryKey: ['task-template-stages', templateId],
    queryFn: () => client.get(`/subfunnel-templates/${templateId}/stages/`).then(r => r.data),
    enabled: !!templateId,
  });
}

export function useSubfunnelTemplateItems(templateId?: number | string) {
  return useQuery<SubfunnelTemplateItem[]>({
    queryKey: ['subfunnel-template-items', templateId],
    queryFn: () => client.get(`/subfunnel-templates/${templateId}/items/`).then(r => r.data),
    enabled: !!templateId,
  });
}

export function useCreateTaskTemplateStage(templateId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TaskTemplateStage>) =>
      client.post(`/subfunnel-templates/${templateId}/stages/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-template-stages', templateId] });
      qc.invalidateQueries({ queryKey: ['subfunnel-templates'] });
    },
  });
}

export function usePatchTaskTemplateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<TaskTemplateStage>) =>
      client.patch(`/task-template-stages/${id}/`, data).then(r => r.data),
    onSuccess: (data: TaskTemplateStage) => {
      qc.invalidateQueries({ queryKey: ['task-template-stages', data.template] });
      qc.invalidateQueries({ queryKey: ['subfunnel-templates'] });
    },
  });
}

export function useDeleteTaskTemplateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; templateId: number }) =>
      client.delete(`/task-template-stages/${id}/`).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task-template-stages', vars.templateId] });
      qc.invalidateQueries({ queryKey: ['subfunnel-templates'] });
    },
  });
}

export function useSubfunnelBindings(funnelId?: number | string) {
  return useQuery<SubfunnelTemplateBinding[]>({
    queryKey: ['subfunnel-bindings', funnelId],
    queryFn: () => client.get(`/funnels/${funnelId}/subfunnel-bindings/`).then(r => r.data),
    enabled: !!funnelId,
  });
}

export function useCreateSubfunnelTemplateItem(templateId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      client.post(`/subfunnel-templates/${templateId}/items/`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subfunnel-templates'] });
    },
  });
}

export function usePatchSubfunnelTemplateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      client.patch(`/subfunnel-template-items/${id}/`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subfunnel-templates'] });
    },
  });
}

export function useDeleteSubfunnelTemplateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => client.delete(`/subfunnel-template-items/${id}/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subfunnel-templates'] });
    },
  });
}

export function useCreateSubfunnelBinding(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SubfunnelTemplateBinding>) =>
      client.post(`/funnels/${funnelId}/subfunnel-bindings/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subfunnel-bindings', funnelId] });
      qc.invalidateQueries({ queryKey: ['funnel', funnelId] });
    },
  });
}

export function usePatchSubfunnelBinding(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<SubfunnelTemplateBinding>) =>
      client.patch(`/subfunnel-template-bindings/${id}/`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subfunnel-bindings', funnelId] });
      qc.invalidateQueries({ queryKey: ['funnel', funnelId] });
    },
  });
}

export function useDeleteSubfunnelBinding(funnelId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => client.delete(`/subfunnel-template-bindings/${id}/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subfunnel-bindings', funnelId] });
      qc.invalidateQueries({ queryKey: ['funnel', funnelId] });
    },
  });
}

// External organizations (Bitrix proxy)
export function useExternalOrganizations(params?: Record<string, any>) {
  return useQuery<import('../types').ExternalOrganization[]>({
    queryKey: ['external-organizations', params],
    queryFn: () =>
      client
        .get('/external-organizations/', { params: { page_size: 1000, ...params } })
        .then(r => {
          const data = r.data;
          if (Array.isArray(data)) return data;
          if (data && Array.isArray(data.results)) return data.results;
          return [];
        }),
    enabled: !!params && Object.values(params).some(v => !!v),
  });
}

/** Организации с is_our_side=true из Bitrix (для выбора ИНН; без фильтров в params) */
export function useExternalOurOrganizations(pageSize = 500) {
  return useQuery<import('../types').ExternalOrganization[]>({
    queryKey: ['external-organizations-our-side', pageSize],
    queryFn: () =>
      client
        .get('/external-organizations/our-side/', { params: { page_size: pageSize } })
        .then(r => r.data ?? []),
    staleTime: 300_000,
  });
}

export function useExternalFedDistricts() {
  return useQuery<import('../types').ExternalFedDistrict[]>({
    queryKey: ['fed-districts-with-regions'],
    queryFn: () => client.get('/federal-districts/with-regions/').then(r => r.data),
    staleTime: 600_000,
  });
}

export function useExternalRegions() {
  return useQuery<{ name: string }[]>({
    queryKey: ['external-regions'],
    queryFn: () => client.get('/external-organizations/regions/').then(r => r.data),
    staleTime: 600_000,
  });
}

export function useExternalOrgTypes() {
  return useQuery<import('../types').ExternalOrgType[]>({
    queryKey: ['external-org-types'],
    queryFn: () => client.get('/external-organizations/org-types/').then(r => r.data),
    staleTime: 600_000,
  });
}

export function useExternalProfActivities() {
  return useQuery<{ id: number; name: string }[]>({
    queryKey: ['external-prof-activities'],
    queryFn: () => client.get('/external-organizations/prof-activities/').then(r => r.data),
    staleTime: 600_000,
  });
}

export function useSyncExternalOrganizations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { organizations: any[] }) =>
      client.post('/external-organizations/sync/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}

// Leads
export function useLeads(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<import('../types').Lead>>({
    queryKey: ['leads', params],
    queryFn: () => client.get('/leads/', { params: { ...params, page_size: 200 } }).then(r => r.data),
  });
}

export function useLead(id: number | string) {
  return useQuery<import('../types').LeadDetail>({
    queryKey: ['lead', id],
    queryFn: () => client.get(`/leads/${id}/`).then(r => r.data),
    enabled: !!id,
  });
}

export function useUpdateLead(id: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => client.patch(`/leads/${id}/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}

/** PATCH лида по id (доска канбана и т.п.) */
export function usePatchLead() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { id: number; data: Record<string, unknown>; campaignId?: number },
    { prev?: CampaignDetail }
  >({
    mutationFn: (vars: { id: number; data: Record<string, unknown>; campaignId?: number }) =>
      client.patch(`/leads/${vars.id}/`, vars.data).then((r) => r.data),
    onMutate: async (vars) => {
      if (vars.campaignId == null || !('current_stage' in vars.data)) return {};
      const key = campaignDetailQueryKey(vars.campaignId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CampaignDetail>(key);
      if (!prev?.leads) return {};
      const raw = vars.data.current_stage;
      const newStage = raw === null || raw === undefined ? null : Number(raw);
      qc.setQueryData<CampaignDetail>(key, {
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === vars.id ? { ...l, current_stage: newStage } : l,
        ),
      });
      return { prev };
    },
    onError: (_e, vars, ctx) => {
      if (ctx?.prev && vars.campaignId != null) {
        qc.setQueryData(campaignDetailQueryKey(vars.campaignId), ctx.prev);
      }
    },
    onSuccess: (_d, { id, campaignId }) => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      if (campaignId != null) {
        qc.invalidateQueries({ queryKey: campaignDetailQueryKey(campaignId) });
      } else {
        qc.invalidateQueries({ queryKey: ['campaign'] });
      }
    },
  });
}

export function useToggleChecklistItem(leadId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (valueId: number) =>
      client.post(`/leads/${leadId}/checklist/${valueId}/toggle/`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['lead-timeline', leadId] });
    },
  });
}

export function useCreateChecklistValue(leadId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      client.post(`/leads/${leadId}/checklist/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead', leadId] }),
  });
}

export function useUpdateChecklistValue(leadId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ valueId, ...data }: { valueId: number } & Record<string, any>) =>
      client.patch(`/leads/${leadId}/checklist/${valueId}/update/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['lead-timeline', leadId] });
    },
  });
}

/** Загрузка одного или нескольких файлов в пункт чек-листа (multipart + JWT). */
export function useUploadChecklistFile(leadId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ valueId, file }: { valueId: number; file: File | File[] }) => {
      const fd = new FormData();
      const list = Array.isArray(file) ? file : [file];
      list.forEach((f) => fd.append('files', f));
      return client
        .patch(`/leads/${leadId}/checklist/${valueId}/update/`, fd)
        .then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['lead-timeline', leadId] });
    },
  });
}

export function useDeleteChecklistAttachment(leadId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      valueId,
      attachmentId,
    }: {
      valueId: number;
      attachmentId: number;
    }) =>
      client
        .delete(
          `/leads/${leadId}/checklist/${valueId}/attachments/${attachmentId}/`,
        )
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['lead-timeline', leadId] });
    },
  });
}

export function useLeadInteractions(
  leadId: number | string | undefined,
  options?: { enabled?: boolean },
) {
  const byDefault = !!leadId;
  const enabled =
    options?.enabled !== undefined ? options.enabled && !!leadId : byDefault;
  return useQuery<import('../types').LeadInteraction[]>({
    queryKey: ['lead-interactions', leadId],
    queryFn: () => client.get(`/leads/${leadId}/interactions/`).then(r => r.data),
    enabled,
  });
}

export type LeadTimelineFilters = {
  /** Одно или несколько через запятую: interaction, stage, checklist */
  kind?: string;
  /** ID контакта из справочника — только взаимодействия с этим контактом и отметки чек-листа с ним */
  contact?: number | null;
};

export function useLeadTimeline(leadId: number | string, filters?: LeadTimelineFilters) {
  const kind = filters?.kind;
  const contact = filters?.contact;
  return useQuery<import('../types').LeadTimelineItem[]>({
    queryKey: ['lead-timeline', leadId, kind ?? 'all', contact ?? 'all'],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (kind) params.kind = kind;
      if (contact != null && contact !== undefined) params.contact = String(contact);
      return client.get(`/leads/${leadId}/timeline/`, { params }).then(r => r.data);
    },
    enabled: !!leadId,
  });
}

export function useCreateLeadInteraction(leadId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      client.post(`/leads/${leadId}/interactions/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-interactions', leadId] });
      qc.invalidateQueries({ queryKey: ['lead-timeline', leadId] });
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
    },
  });
}

export function useAdvanceLeadStage(leadId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post(`/leads/${leadId}/advance-stage/`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['lead-timeline', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useRetreatLeadStage(leadId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post(`/leads/${leadId}/retreat-stage/`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['lead-timeline', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useRejectLead(leadId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post(`/leads/${leadId}/reject/`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['lead-timeline', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useBulkUpdateLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: number[]; current_stage: number | null }) =>
      client.post<import('../types').BulkActionResult>('/leads/bulk-update/', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['campaign'] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useBulkDeleteLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      client.post<import('../types').BulkActionResult>('/leads/bulk-delete/', { ids }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['campaign'] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

// Campaigns
export function useCampaigns(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<Campaign>>({
    queryKey: ['campaigns', params],
    queryFn: () => client.get('/campaigns/', { params }).then(r => r.data),
  });
}

export function useCampaign(id: number | string) {
  const key = campaignDetailQueryKey(id);
  return useQuery<CampaignDetail>({
    queryKey: key,
    queryFn: () => client.get(`/campaigns/${key[1]}/`).then(r => r.data),
    enabled: !!key[1],
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => client.post('/campaigns/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useUpdateCampaign(id: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => client.patch(`/campaigns/${id}/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: campaignDetailQueryKey(id) });
    },
  });
}

/** PATCH кампании по id (доска, dnd и т.п.) */
export function usePatchCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      client.patch(`/campaigns/${id}/`, data).then((r) => r.data),
    onMutate: async ({ id, data }) => {
      const boardColumn = data.board_column as (Campaign['status'] | 'organization_list' | undefined);
      const status = (
        boardColumn === 'organization_list'
          ? 'active'
          : boardColumn || data.status
      ) as Campaign['status'] | undefined;
      if (status === undefined) return {};
      const operationalStage = boardColumn === undefined
        ? undefined
        : (boardColumn === 'organization_list' ? 'organization_list' : '');
      await qc.cancelQueries({ queryKey: ['campaigns'] });
      const previous = qc.getQueriesData<PaginatedResponse<Campaign>>({ queryKey: ['campaigns'] });
      qc.setQueriesData<PaginatedResponse<Campaign>>({ queryKey: ['campaigns'] }, (old) => {
        if (!old?.results) return old;
        return {
          ...old,
          results: old.results.map((c) => (
            c.id === id
              ? {
                  ...c,
                  status,
                  ...(operationalStage !== undefined ? { operational_stage: operationalStage } : {}),
                }
              : c
          )),
        };
      });
      return { previous };
    },
    onError: (_e, _vars, ctx) => {
      ctx?.previous?.forEach(([queryKey, data]) => {
        qc.setQueryData(queryKey, data);
      });
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: campaignDetailQueryKey(id) });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => client.delete(`/campaigns/${id}/`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.removeQueries({ queryKey: campaignDetailQueryKey(id) });
    },
  });
}

export function useBulkUpdateCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ids: number[];
      board_column?: string;
      status?: string;
    }) => client.post<import('../types').BulkActionResult>('/campaigns/bulk-update/', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useBulkDeleteCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      client.post<import('../types').BulkActionResult>('/campaigns/bulk-delete/', { ids }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useAddCampaignPrograms(campaignId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { program_ids: number[] }) =>
      client.post(`/campaigns/${campaignId}/programs/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignDetailQueryKey(campaignId) }),
  });
}

export function useAddCampaignRegions(campaignId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { regions: any[] }) =>
      client.post(`/campaigns/${campaignId}/regions/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignDetailQueryKey(campaignId) }),
  });
}

export function useAddCampaignOrganizations(campaignId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { organization_ids: number[] }) =>
      client.post(`/campaigns/${campaignId}/organizations/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignDetailQueryKey(campaignId) }),
  });
}

export function useAssignManagers(campaignId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { assignments: any[] }) =>
      client.post(`/campaigns/${campaignId}/assign-managers/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignDetailQueryKey(campaignId) }),
  });
}

export function useWorkloadDashboard(params?: {
  role?: 'all' | 'manager' | 'specialist';
  campaign?: number;
  funnel?: number;
  user?: number;
  date_from?: string;
  date_to?: string;
}) {
  return useQuery<WorkloadDashboardResponse>({
    queryKey: ['workload-dashboard', params],
    queryFn: () => client.get('/campaigns/workload-dashboard/', { params }).then(r => r.data),
    staleTime: 60_000,
  });
}

export function useCampaignSubfunnels(campaignId?: number | string) {
  return useQuery<CampaignSubfunnel[]>({
    queryKey: ['campaign-subfunnels', campaignId],
    queryFn: () => client.get(`/campaigns/${campaignId}/subfunnels/`).then(r => r.data),
    enabled: !!campaignId,
  });
}

export function useSubfunnelWorkspace(params?: {
  campaign?: number;
  template?: number;
  subfunnel?: number;
  role?: number;
  assignee?: number;
  status?: number | string;
  overdue?: boolean;
  view_mode?: 'kanban' | 'table';
}) {
  return useQuery<SubfunnelWorkspaceResponse>({
    queryKey: ['subfunnel-workspace', params],
    queryFn: () => client.get('/campaigns/subfunnel-workspace/', { params }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useLeadSubfunnels(leadId?: number | string) {
  return useQuery<LeadSubfunnel[]>({
    queryKey: ['lead-subfunnels', leadId],
    queryFn: () => client.get(`/leads/${leadId}/subfunnels/`).then(r => r.data),
    enabled: !!leadId,
  });
}

export function useLeadSubfunnel(id?: number | null) {
  return useQuery<LeadSubfunnel>({
    queryKey: ['lead-subfunnel', id],
    queryFn: () => client.get(`/lead-subfunnels/${id}/`).then(r => r.data),
    enabled: !!id,
  });
}

function invalidateTaskRelatedQueries(qc: ReturnType<typeof useQueryClient>, leadId?: number | null) {
  qc.invalidateQueries({ queryKey: ['lead-subfunnel'] });
  qc.invalidateQueries({ queryKey: ['lead-subfunnels'] });
  qc.invalidateQueries({ queryKey: ['subfunnel-workspace'] });
  qc.invalidateQueries({ queryKey: ['leads'] });
  qc.invalidateQueries({ queryKey: ['campaign'] });
  if (leadId) {
    qc.invalidateQueries({ queryKey: ['lead', String(leadId)] });
  }
}

export function usePatchLeadSubfunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<LeadSubfunnel>) =>
      client.patch(`/lead-subfunnels/${id}/`, data).then(r => r.data),
    onSuccess: (data: LeadSubfunnel) => {
      invalidateTaskRelatedQueries(qc, data?.lead);
    },
  });
}

export function usePatchLeadSubfunnelChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      rows,
    }: {
      id: number;
      rows: Array<{ id: number; is_completed?: boolean; text_value?: string; assignee?: number | null }>;
    }) => client.patch(`/lead-subfunnels/${id}/checklist/`, rows).then(r => r.data),
    onSuccess: (_data, vars) => {
      invalidateTaskRelatedQueries(qc);
      qc.invalidateQueries({ queryKey: ['lead-subfunnel', vars.id] });
    },
  });
}

export function useAdvanceLeadSubfunnelStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      client.post(`/lead-subfunnels/${id}/advance-task-stage/`).then(r => r.data),
    onSuccess: (data: LeadSubfunnel) => {
      invalidateTaskRelatedQueries(qc, data?.lead);
    },
  });
}

export function useRetreatLeadSubfunnelStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      client.post(`/lead-subfunnels/${id}/retreat-task-stage/`).then(r => r.data),
    onSuccess: (data: LeadSubfunnel) => {
      invalidateTaskRelatedQueries(qc, data?.lead);
    },
  });
}

export function useSetLeadSubfunnelStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage_id }: { id: number; stage_id: number }) =>
      client.post(`/lead-subfunnels/${id}/set-task-stage/`, { stage_id }).then(r => r.data),
    onSuccess: (data: LeadSubfunnel) => {
      invalidateTaskRelatedQueries(qc, data?.lead);
    },
  });
}

export function useCampaignCollectStageImport(campaignId?: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      client
        .post<CampaignCollectStageImportResult>(`/campaigns/${campaignId}/collect-stage-import/`, formData)
        .then((r) => r.data),
    onSuccess: () => {
      if (campaignId) {
        qc.invalidateQueries({ queryKey: ['campaign', String(campaignId)] });
      }
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useOrganizationListCapture(campaignId?: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      mode?: 'minimal' | 'full';
      campaign_region_id?: number;
      force_task_addition?: boolean;
      source_lead_id?: number;
      source_transfer_comment?: string;
      items: Array<Record<string, any>>;
    }) =>
      client
        .post<OrganizationListCaptureResult>(`/campaigns/${campaignId}/organization-list-capture/`, data)
        .then((r) => r.data),
    onSuccess: () => {
      invalidateTaskRelatedQueries(qc);
      if (campaignId) {
        qc.invalidateQueries({ queryKey: ['campaign', String(campaignId)] });
      }
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useOrganizationListSelect(campaignId?: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      campaign_region_id?: number;
      force_task_addition?: boolean;
      source_lead_id?: number;
      source_transfer_comment?: string;
      items: Array<{ organization_id: number; contact_id?: number | null }>;
    }) =>
      client
        .post<CampaignCollectStageImportResult>(`/campaigns/${campaignId}/organization-list-select/`, data)
        .then((r) => r.data),
    onSuccess: () => {
      invalidateTaskRelatedQueries(qc);
      if (campaignId) {
        qc.invalidateQueries({ queryKey: ['campaign', String(campaignId)] });
      }
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useRegionTaskCapture(taskId?: number | null) {
  return useQuery<RegionTaskCaptureSummary>({
    queryKey: ['lead-subfunnel', taskId, 'region-capture'],
    queryFn: () => client.get(`/lead-subfunnels/${taskId}/region-capture/`).then((r) => r.data),
    enabled: !!taskId,
  });
}

export function useBulkUpdateLeadSubfunnels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ids: number[];
      assignee?: number | null;
      due_at?: string | null;
      clear_due_at?: boolean;
      stage_id?: number | null;
      status?: string;
    }) => client.post<LeadSubfunnelBulkUpdateResult>('/lead-subfunnels/bulk-update/', data).then(r => r.data),
    onSuccess: () => {
      invalidateTaskRelatedQueries(qc);
    },
  });
}

export function useBulkUpdateLeadSubfunnelChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ids: number[];
      template_item_id: number;
      is_completed?: boolean;
      text_value?: string;
    }) => client.post<LeadSubfunnelBulkChecklistResult>('/lead-subfunnels/bulk-checklist/', data).then(r => r.data),
    onSuccess: () => {
      invalidateTaskRelatedQueries(qc);
    },
  });
}

export function useBulkDeleteLeadSubfunnels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      client.post<import('../types').BulkActionResult>('/lead-subfunnels/bulk-delete/', { ids }).then((r) => r.data),
    onSuccess: () => {
      invalidateTaskRelatedQueries(qc);
    },
  });
}

// --- Contacts ---

export function useContacts(params?: Record<string, any>) {
  const merged =
    params?.page != null || params?.page_size != null
      ? { ...(params ?? {}) }
      : { page_size: 200, ...(params ?? {}) };
  const paginated = params?.page != null || params?.page_size != null;
  return useQuery<PaginatedResponse<Contact>>({
    queryKey: ['contacts', merged],
    queryFn: () => client.get('/contacts/', { params: merged }).then(r => r.data),
    placeholderData: paginated ? keepPreviousData : undefined,
  });
}

export function useContactsByOrganization(orgName: string | undefined) {
  return useQuery<import('../types').Contact[]>({
    queryKey: ['contacts', 'by-org', orgName],
    queryFn: () =>
      client.get('/contacts/', { params: { organization_name: orgName, page_size: 200 } })
        .then(r => r.data.results ?? r.data),
    enabled: !!orgName,
  });
}

export function useContactsByOrganizationId(organizationId?: number) {
  return useQuery<PaginatedResponse<Contact>>({
    queryKey: ['contacts', 'by-org-id', organizationId],
    queryFn: () =>
      client.get('/contacts/', { params: { organization: organizationId, page_size: 200 } }).then((r) => r.data),
    enabled: !!organizationId,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      client.post('/contacts/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, any>) =>
      client.patch(`/contacts/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useImportContactsXlsx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      client.post('/contacts/import-xlsx/', formData).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['import-batches'] });
    },
  });
}

export function useImportOrganizationsXlsx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      client.post('/organizations/import-xlsx/', formData).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['import-batches'] });
    },
  });
}

export function useImportBatches(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<import('../types').ImportBatch>>({
    queryKey: ['import-batches', params],
    queryFn: () => client.get('/import-batches/', { params }).then(r => r.data),
  });
}

export function useRollbackImportBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: number) =>
      client.post<import('../types').ImportBatchRollbackResult>(`/import-batches/${batchId}/rollback/`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-batches'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useContactChangeLog(contactId: number | undefined, params?: Record<string, any>) {
  const merged = { page_size: 50, ...(params ?? {}) };
  return useQuery<PaginatedResponse<EntityFieldChange>>({
    queryKey: ['contacts', contactId, 'change-log', merged],
    queryFn: () => client.get(`/contacts/${contactId}/change-log/`, { params: merged }).then(r => r.data),
    enabled: !!contactId,
  });
}

export function useOrganizationChangeLog(organizationId: number | undefined, params?: Record<string, any>) {
  const merged = { page_size: 50, ...(params ?? {}) };
  return useQuery<PaginatedResponse<EntityFieldChange>>({
    queryKey: ['organizations', organizationId, 'change-log', merged],
    queryFn: () => client.get(`/organizations/${organizationId}/change-log/`, { params: merged }).then(r => r.data),
    enabled: !!organizationId,
  });
}

export function useExternalContacts(orgName: string | undefined) {
  return useQuery<import('../types').ExternalContact[]>({
    queryKey: ['external-contacts', orgName],
    queryFn: () =>
      client.get('/external-contacts/', { params: { organization__contains: orgName } })
        .then(r => r.data),
    enabled: !!orgName,
  });
}

export function useExternalContactHistory(contactId: number | undefined, page = 1, pageSize = 20) {
  return useQuery<PaginatedResponse<import('../types').ExternalContactHistoryRecord>>({
    queryKey: ['external-contact-history', contactId, page, pageSize],
    queryFn: () =>
      client
        .get('/external-contacts/history/', {
          params: { id: contactId, page, page_size: pageSize },
        })
        .then(r => r.data),
    enabled: !!contactId,
  });
}

export function useAddExternalContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      client.post('/external-contacts/add/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateExternalContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: number } & Record<string, any>) =>
      client.patch('/external-contacts/update/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useExternalCommunications(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<import('../types').ExternalCommunication> | import('../types').ExternalCommunication[]>({
    queryKey: ['external-communications', params],
    queryFn: () => client.get('/external-communications/', { params }).then(r => r.data),
  });
}

export function useAddExternalCommunication() {
  return useMutation({
    mutationFn: (data: import('../types').ExternalCommunicationPayload) =>
      client.post('/external-communications/add/', data).then(r => r.data),
  });
}

export function useUpdateExternalCommunication() {
  return useMutation({
    mutationFn: (data: { id: number } & Partial<import('../types').ExternalCommunicationPayload>) =>
      client.patch('/external-communications/update/', data).then(r => r.data),
  });
}

export function useSyncUserAsOurSideContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      user_id?: number;
      /** Один ИНН (совместимость) */
      organization_inn?: string;
      /** Несколько ИНН — отдельный контакт Bitrix на каждую организацию */
      organization_inns?: string[] | string;
      manager?: boolean;
      position?: string;
      comment?: string;
      /** Дублировать в локальный Contact (по умолчанию true) */
      sync_local?: boolean;
    }) =>
      client
        .post<import('../types').SyncUserAsOurSideContactResponse>(
          '/external-contacts/sync-user/',
          data,
        )
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useSyncExternalContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { organization_name: string; contacts: any[] }) =>
      client.post('/external-contacts/sync/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

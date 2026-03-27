import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type {
  PaginatedResponse, Campaign, CampaignDetail,
  Region, FederalDistrict, Profession, Program,
  FederalOperator, Organization, Quota, DemandMatrix, UserShort,
  Funnel, FunnelDetail, FunnelStage, StageChecklistItem, ChecklistItemOption,
} from '../types';

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

export function useFederalOperators() {
  return useQuery<PaginatedResponse<FederalOperator>>({
    queryKey: ['federal-operators'],
    queryFn: () => client.get('/federal-operators/').then(r => r.data),
    staleTime: 600_000,
  });
}

export function useOrganizations(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<Organization>>({
    queryKey: ['organizations', params],
    queryFn: () => client.get('/organizations/', { params: { ...params, page_size: 200 } }).then(r => r.data),
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
    mutationFn: (data: { name: string; description?: string }) =>
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
    mutationFn: (data: { name: string; order: number; deadline_days: number }) =>
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
    mutationFn: (data: { stage: number; text: string; order: number; confirmation_types: string[] }) =>
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

// Campaigns
export function useCampaigns(params?: Record<string, any>) {
  return useQuery<PaginatedResponse<Campaign>>({
    queryKey: ['campaigns', params],
    queryFn: () => client.get('/campaigns/', { params }).then(r => r.data),
  });
}

export function useCampaign(id: number | string) {
  return useQuery<CampaignDetail>({
    queryKey: ['campaign', id],
    queryFn: () => client.get(`/campaigns/${id}/`).then(r => r.data),
    enabled: !!id,
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
      qc.invalidateQueries({ queryKey: ['campaign', id] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => client.delete(`/campaigns/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useAddCampaignPrograms(campaignId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { program_ids: number[] }) =>
      client.post(`/campaigns/${campaignId}/programs/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  });
}

export function useAddCampaignRegions(campaignId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { regions: any[] }) =>
      client.post(`/campaigns/${campaignId}/regions/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  });
}

export function useAddCampaignOrganizations(campaignId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { organization_ids: number[] }) =>
      client.post(`/campaigns/${campaignId}/organizations/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  });
}

export function useAssignManagers(campaignId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { assignments: any[] }) =>
      client.post(`/campaigns/${campaignId}/assign-managers/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  });
}

// --- Contacts ---

export function useContacts(params?: Record<string, any>) {
  return useQuery<import('../types').Contact[]>({
    queryKey: ['contacts', params],
    queryFn: () => client.get('/contacts/', { params }).then(r => r.data.results ?? r.data),
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

export function useExternalContacts(orgName: string | undefined) {
  return useQuery<any[]>({
    queryKey: ['external-contacts', orgName],
    queryFn: () =>
      client.get('/external-contacts/', { params: { organization__contains: orgName } })
        .then(r => r.data),
    enabled: !!orgName,
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

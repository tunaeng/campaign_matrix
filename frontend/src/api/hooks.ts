import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type {
  PaginatedResponse, Campaign, CampaignDetail,
  Region, FederalDistrict, Profession, Program,
  FederalOperator, Organization, Quota, DemandMatrix, UserShort,
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

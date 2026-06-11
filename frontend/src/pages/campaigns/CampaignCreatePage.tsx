import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Steps, Button, Space, Typography, App, Spin, Tooltip } from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined,
  WarningOutlined, RocketOutlined,
} from '@ant-design/icons';
import {
  useCreateCampaign, useUpdateCampaign, useCampaign,
} from '../../api/hooks';
import StepBasicInfo from './steps/StepBasicInfo';
import StepPrograms from './steps/StepPrograms';
import StepOrganizations from './steps/StepOrganizations';
import StepRegions from './steps/StepRegions';
import StepManagers from './steps/StepManagers';
import StepReview from './steps/StepReview';
import type { ExternalOrganization } from '../../types';

export interface CampaignOrganizationOption extends ExternalOrganization {
  id: number;
}

export interface QueueFormData {
  queue_number: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  stage_deadlines: { funnel_stage_id: number; deadline_days: number }[];
}

export interface OrgDistributionItem {
  programIds: number[];
  managerId: number | null;
  manuallySetManager: boolean;
  profActivity: string | null;
  manuallySetProfActivity: boolean;
  forecastDemand: number | null;
}

export type ForecastDemandMode = 'total' | 'per_org' | 'per_queue';

export interface CampaignFormData {
  name: string;
  federal_operator: number | null;
  federal_operator_ids: number[];
  project: number | null;
  acting_organization: number | null;
  hypothesis: string;
  selectedFunnels: number[];
  selectedPrograms: number[];
  queues: QueueFormData[];
  regionData: {
    region_id: number;
    queue_number: number | null;
    manager_id: number | null;
    specialist_id?: number | null;
    demand_quota?: number;
    search_task?: string;
  }[];
  collectSearchTask: string;
  hasCollectStage: boolean;
  selectedOrganizations: number[];
  selectedExternalOrgs: CampaignOrganizationOption[];
  federalOrgRegionSelections: Record<number, number[]>;
  orgRegionForecast: Record<string, number | null>;
  orgQueueAssignments: Record<string, number>;
  orgFunnelAssignments: Record<string, number>;
  profActivityList: string[];
  orgDistribution: Record<string, OrgDistributionItem>;
  managerAssignments: { level: string; target_id: number; manager_id: number }[];
  forecastDemandMode: ForecastDemandMode;
  forecastDemandTotal: number | null;
  forecastDemandPerQueue: Record<number, number | null>;
  tagIds: number[];
}

const initialData: CampaignFormData = {
  name: '',
  federal_operator: null,
  federal_operator_ids: [],
  project: null,
  acting_organization: null,
  hypothesis: '',
  selectedFunnels: [],
  selectedPrograms: [],
  queues: [{ queue_number: 1, name: 'Очередь 1', start_date: null, end_date: null, stage_deadlines: [] }],
  regionData: [],
  collectSearchTask: '',
  hasCollectStage: false,
  selectedOrganizations: [],
  selectedExternalOrgs: [],
  federalOrgRegionSelections: {},
  orgRegionForecast: {},
  orgQueueAssignments: {},
  orgFunnelAssignments: {},
  profActivityList: [],
  orgDistribution: {},
  managerAssignments: [],
  forecastDemandMode: 'total',
  forecastDemandTotal: null,
  forecastDemandPerQueue: {},
  tagIds: [],
};

const COLLECT_STAGE_STORAGE_PREFIX = 'campaign-hasCollectStage-';

function getStoredHasCollectStage(campaignId: number | null): boolean | null {
  try {
    const value = sessionStorage.getItem(`${COLLECT_STAGE_STORAGE_PREFIX}${campaignId ?? 'new'}`);
    if (value === null) return null;
    return value === 'true';
  } catch {
    return null;
  }
}

function setStoredHasCollectStage(campaignId: number | null, value: boolean) {
  try {
    sessionStorage.setItem(`${COLLECT_STAGE_STORAGE_PREFIX}${campaignId ?? 'new'}`, String(value));
  } catch {
    // ignore quota / private mode
  }
}

function inferHasCollectStage(
  collectSearchTask: string | null | undefined,
  regionsCount: number,
  campaignId: number | null,
): boolean {
  if (collectSearchTask?.trim()) return true;
  if (regionsCount > 0) return true;
  const stored = getStoredHasCollectStage(campaignId);
  return stored ?? false;
}

function getStepTitles(hasCollectStage: boolean) {
  return ['Основное', 'Программы', hasCollectStage ? 'Регионы' : 'Организации', 'Распределение', 'Обзор'];
}

/** При режиме total/per_queue бэкенд сам делит цель между лидами. */
function buildForecastPayload(fd: CampaignFormData) {
  const queueGoals =
    fd.forecastDemandMode === 'per_queue'
      ? Object.fromEntries(
          Object.entries(fd.forecastDemandPerQueue).filter(([, v]) => v != null) as [string, number][],
        )
      : null;
  return {
    forecast_demand_mode: fd.forecastDemandMode,
    forecast_total_goal: fd.forecastDemandMode === 'total' ? fd.forecastDemandTotal : null,
    forecast_queue_goals: queueGoals,
  };
}

function getLeadRegionIds(fd: CampaignFormData, org: CampaignOrganizationOption): Array<number | null> {
  if (!org.federal_company) {
    return [org.region_id ?? null];
  }
  const selected = fd.federalOrgRegionSelections?.[org.id] || [];
  if (selected.length > 0) {
    return Array.from(new Set(selected));
  }
  return [org.region_id ?? null];
}

function leadForecastKey(orgId: number, regionId: number | null): string {
  return `${orgId}:${regionId ?? 'null'}`;
}

function buildLeadData(fd: CampaignFormData, includePrograms: boolean) {
  if (fd.hasCollectStage) {
    return [];
  }
  const leadData: Array<Record<string, any>> = [];
  for (const org of fd.selectedExternalOrgs) {
    const dist = fd.orgDistribution[org.name];
    const qNum = fd.orgQueueAssignments[org.name] || 1;
    const funnelId = fd.orgFunnelAssignments[org.name] || fd.selectedFunnels[0] || null;
    const regionIds = getLeadRegionIds(fd, org);

    for (const regionId of regionIds) {
      const perLeadForecast =
        fd.forecastDemandMode === 'per_org'
          ? (
            fd.orgRegionForecast?.[leadForecastKey(org.id, regionId)] ??
            dist?.forecastDemand ??
            null
          )
          : null;
      const lead: Record<string, any> = {
        organization_id: org.id,
        organization_name: org.full_name || org.name,
        region_id: regionId,
        funnel_id: funnelId,
        queue_number: qNum,
        manager_id: dist?.managerId || null,
        forecast_demand: perLeadForecast,
      };
      if (includePrograms) {
        lead.program_ids = dist?.programIds ?? fd.selectedPrograms;
      }
      leadData.push(lead);
    }
  }
  return leadData;
}

function getStepValid(fd: CampaignFormData): boolean[] {
  const hasFederalWithoutRegions = fd.selectedExternalOrgs.some(
    (org) => org.federal_company && (fd.federalOrgRegionSelections?.[org.id]?.length ?? 0) === 0,
  );
  return [
    !!(fd.name.trim() && fd.federal_operator_ids.length > 0 && fd.selectedFunnels.length > 0),
    fd.selectedPrograms.length >= 1,
    fd.hasCollectStage
      ? fd.regionData.length >= 1
      : (fd.selectedExternalOrgs.length >= 1 && !hasFederalWithoutRegions),
    true,
    true,
  ];
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export default function CampaignCreatePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEditMode = !!editId;

  const createCampaign = useCreateCampaign();

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<CampaignFormData>(() => ({
    ...initialData,
    hasCollectStage: getStoredHasCollectStage(null) ?? false,
  }));
  const [campaignId, setCampaignId] = useState<number | null>(editId ? Number(editId) : null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(!editId);

  const updateCampaign = useUpdateCampaign(campaignId ?? 0);

  // Load existing campaign data in edit mode
  const { data: existingCampaign, isLoading: loadingCampaign } = useCampaign(editId ?? '');

  useEffect(() => {
    if (!existingCampaign || initialLoaded) return;

    const selectedPrograms = existingCampaign.campaign_programs?.map((cp) => cp.program) ?? [];

    // Map queue id → queue_number for lead reconstruction
    const queueIdToNumber: Record<number, number> = {};
    for (const q of existingCampaign.queues ?? []) {
      queueIdToNumber[q.id] = q.queue_number;
    }

    // Reconstruct selected organizations and per-org settings from saved leads
    const leads = existingCampaign.leads ?? [];
    const selectedByOrgId = new Map<number, CampaignOrganizationOption>();
    const orgQueueAssignments: Record<string, number> = {};
    const orgDistribution: Record<string, OrgDistributionItem> = {};
    const forecastByOrgName: Record<string, number | null> = {};
    const leadRegionsByOrg: Record<number, Set<number>> = {};
    const orgRegionForecast: Record<string, number | null> = {};

    for (const lead of leads) {
      if (!selectedByOrgId.has(lead.organization)) {
        selectedByOrgId.set(lead.organization, {
          id: lead.organization,
          name: lead.organization_name,
          full_name: lead.organization_name,
          type: '',
          region: lead.organization_region || '',
          region_id: lead.region ?? null,
          federal_company: false,
          fed_district: '',
          prof_activity: '',
          projects: [],
          is_active: true,
          created_at: '',
          updated_at: '',
        });
      }

      if (lead.region != null) {
        if (!leadRegionsByOrg[lead.organization]) {
          leadRegionsByOrg[lead.organization] = new Set<number>();
        }
        leadRegionsByOrg[lead.organization]!.add(lead.region);
      }
      orgRegionForecast[leadForecastKey(lead.organization, lead.region ?? null)] = lead.forecast_demand ?? null;

      if (orgQueueAssignments[lead.organization_name] == null) {
        orgQueueAssignments[lead.organization_name] =
          lead.queue ? (queueIdToNumber[lead.queue] ?? 1) : 1;
      }

      if (!(lead.organization_name in forecastByOrgName)) {
        forecastByOrgName[lead.organization_name] = lead.forecast_demand ?? null;
      }

      if (!orgDistribution[lead.organization_name]) {
        orgDistribution[lead.organization_name] = {
          programIds: [...selectedPrograms],
          managerId: lead.manager ?? null,
          manuallySetManager: lead.manager !== null,
          profActivity: null,
          manuallySetProfActivity: false,
          forecastDemand: null,
        };
      }
    }

    const federalOrgRegionSelections: Record<number, number[]> = {};
    for (const [orgIdStr, regionSet] of Object.entries(leadRegionsByOrg)) {
      if (regionSet.size > 1) {
        federalOrgRegionSelections[Number(orgIdStr)] = Array.from(regionSet);
      }
    }

    const selectedExternalOrgs = Array.from(selectedByOrgId.values()).map((org) => ({
      ...org,
      federal_company: (federalOrgRegionSelections[org.id]?.length ?? 0) > 1,
    }));

    for (const [orgName, forecast] of Object.entries(forecastByOrgName)) {
      if (orgDistribution[orgName]) {
        orgDistribution[orgName].forecastDemand = forecast;
      }
    }

    // Detect forecast demand mode from saved data
    const demandValues = leads.map((l) => l.forecast_demand).filter((v) => v != null);
    let forecastDemandMode: ForecastDemandMode = 'total';
    let forecastDemandTotal: number | null = null;
    const forecastDemandPerQueue: Record<number, number | null> = {};

    if (demandValues.length > 0) {
      const allSame = demandValues.every((v) => v === demandValues[0]);
      if (allSame && leads.length === demandValues.length) {
        forecastDemandMode = 'total';
        // Сумма по лидам (= n × доля, если все доли равны). При старом баге сумма завышена — поправьте поле и сохраните.
        forecastDemandTotal = leads.reduce((s, l) => s + (l.forecast_demand ?? 0), 0);
      } else {
        const queueGroups: Record<number, number[]> = {};
        for (const lead of leads) {
          const qNum = lead.queue ? (queueIdToNumber[lead.queue] ?? 1) : 1;
          if (!queueGroups[qNum]) queueGroups[qNum] = [];
          if (lead.forecast_demand != null) queueGroups[qNum].push(lead.forecast_demand);
        }
        const samePerQueue = Object.entries(queueGroups).every(
          ([, vals]) => vals.length > 0 && vals.every((v) => v === vals[0])
        );
        if (samePerQueue && demandValues.length === leads.length) {
          forecastDemandMode = 'per_queue';
          for (const [qNum, vals] of Object.entries(queueGroups)) {
            if (!vals.length) continue;
            // Доля на лид × число лидов в очереди = цель по очереди в форме
            forecastDemandPerQueue[Number(qNum)] = vals[0]! * vals.length;
          }
        } else {
          forecastDemandMode = 'per_org';
        }
      }
    }

    const hasCollectStage = inferHasCollectStage(
        existingCampaign.collect_search_task,
        existingCampaign.campaign_regions?.length ?? 0,
        Number(editId),
      );
    setStoredHasCollectStage(Number(editId), hasCollectStage);
    setFormData({
      name: existingCampaign.name,
      federal_operator: existingCampaign.federal_operator,
      federal_operator_ids:
        (existingCampaign.federal_operators && existingCampaign.federal_operators.length > 0)
          ? existingCampaign.federal_operators
          : (existingCampaign.federal_operator ? [existingCampaign.federal_operator] : []),
      project: existingCampaign.project ?? null,
      acting_organization: existingCampaign.acting_organization ?? null,
      hypothesis: existingCampaign.hypothesis || '',
      selectedFunnels: existingCampaign.campaign_funnels?.map((cf) => cf.funnel) ?? [],
      selectedPrograms,
      tagIds: existingCampaign.tags ?? [],
      queues: existingCampaign.queues?.length
        ? existingCampaign.queues.map((q) => ({
            queue_number: q.queue_number,
            name: q.name,
            start_date: q.start_date,
            end_date: q.end_date,
            stage_deadlines: (q.stage_deadlines || []).map((sd) => ({
              funnel_stage_id: sd.funnel_stage,
              deadline_days: sd.deadline_days,
            })),
          }))
        : initialData.queues,
      regionData: existingCampaign.campaign_regions?.map((cr) => {
        const queueNumber = cr.queue
          ? (existingCampaign.queues?.find((q) => q.id === cr.queue)?.queue_number ?? 1)
          : 1;
        return {
          region_id: cr.region,
          queue_number: queueNumber,
          manager_id: cr.manager ?? null,
          specialist_id: cr.primary_contact_specialist ?? null,
          demand_quota: cr.demand_quota ?? 0,
          search_task: cr.search_task ?? '',
        };
      }) ?? [],
      collectSearchTask: existingCampaign.collect_search_task ?? '',
      hasCollectStage,
      selectedOrganizations: [],
      selectedExternalOrgs,
      federalOrgRegionSelections,
      orgRegionForecast,
      orgQueueAssignments,
      orgFunnelAssignments: {},
      profActivityList: [],
      orgDistribution,
      managerAssignments: [],
      forecastDemandMode,
      forecastDemandTotal,
      forecastDemandPerQueue,
    });
    setInitialLoaded(true);
  }, [existingCampaign, initialLoaded]);

  // Ref to avoid stale closure in the debounce timer
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const campaignIdRef = useRef(campaignId);
  campaignIdRef.current = campaignId;

  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const basicSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipBasicAutosaveRef = useRef(true);

  const updateFormData = (partial: Partial<CampaignFormData>) => {
    if ('hasCollectStage' in partial) {
      setStoredHasCollectStage(campaignIdRef.current, !!partial.hasCollectStage);
    }
    setFormData((prev) => ({ ...prev, ...partial }));
  };

  useEffect(() => {
    if (!campaignId) return;
    const idKey = `${COLLECT_STAGE_STORAGE_PREFIX}${campaignId}`;
    const newKey = `${COLLECT_STAGE_STORAGE_PREFIX}new`;
    const draftValue = sessionStorage.getItem(newKey);
    if (draftValue !== null && sessionStorage.getItem(idKey) === null) {
      sessionStorage.setItem(idKey, draftValue);
    }
  }, [campaignId]);

  // Auto-create draft when name is entered (debounced 700ms) — only in create mode
  useEffect(() => {
    clearTimeout(nameTimerRef.current);
    if (!formData.name.trim()) return;
    if (campaignId) return; // already created
    if (isEditMode) return; // no auto-create in edit mode

    nameTimerRef.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const result = await createCampaign.mutateAsync({
          name: formData.name.trim(),
          status: 'draft',
          federal_operator: formData.federal_operator,
          federal_operator_ids: formData.federal_operator_ids,
          project: formData.project,
          acting_organization: formData.acting_organization,
          collect_search_task: formData.collectSearchTask,
          has_collect_stage: formData.hasCollectStage,
          tags: formData.tagIds?.length ? formData.tagIds : undefined,
        });
        setCampaignId(result.id);
        navigate(`/campaigns/${result.id}/edit`, { replace: true });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 700);

    return () => clearTimeout(nameTimerRef.current);
  }, [formData.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save основных полей (шаг 0), чтобы выбор ФО и др. сохранялся при перезагрузке
  useEffect(() => {
    if (!campaignId) return;
    if (isEditMode && !initialLoaded) return;
    if (skipBasicAutosaveRef.current) {
      skipBasicAutosaveRef.current = false;
      return;
    }
    clearTimeout(basicSaveTimerRef.current);
    basicSaveTimerRef.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        await updateCampaign.mutateAsync({
          name: formData.name,
          federal_operator: formData.federal_operator,
          federal_operator_ids: formData.federal_operator_ids,
          project: formData.project,
          acting_organization: formData.acting_organization,
          collect_search_task: formData.collectSearchTask,
          hypothesis: formData.hypothesis,
          funnel_ids: formData.selectedFunnels,
          has_collect_stage: formData.hasCollectStage,
          tags: formData.tagIds,
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 800);
    return () => clearTimeout(basicSaveTimerRef.current);
  }, [
    campaignId,
    initialLoaded,
    isEditMode,
    formData.name,
    formData.federal_operator,
    formData.federal_operator_ids,
    formData.project,
    formData.acting_organization,
    formData.collectSearchTask,
    formData.hypothesis,
    formData.selectedFunnels,
    formData.tagIds,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build PATCH payload for the given step (accumulates all steps up to current)
  const buildPatchPayload = (fd: CampaignFormData, upToStep: number) => {
    const payload: Record<string, any> = {
      name: fd.name,
      federal_operator: fd.federal_operator,
      federal_operator_ids: fd.federal_operator_ids,
      project: fd.project,
      acting_organization: fd.acting_organization,
      collect_search_task: fd.collectSearchTask,
      hypothesis: fd.hypothesis,
      has_collect_stage: fd.hasCollectStage,
    };
    if (upToStep >= 0) {
      payload.funnel_ids = fd.selectedFunnels;
      payload.tags = fd.tagIds;
    }
    if (upToStep >= 1) {
      payload.program_ids = fd.selectedPrograms;
    }
    if (upToStep >= 2) {
      payload.queues = fd.queues.map((q) => ({
        queue_number: q.queue_number,
        name: q.name,
        start_date: q.start_date,
        end_date: q.end_date,
        stage_deadlines: q.stage_deadlines,
      }));
      if (fd.hasCollectStage) {
        payload.region_data = fd.regionData.map((rd) => ({
          ...rd,
          queue_number: rd.queue_number ?? 1,
          search_task: rd.search_task?.trim() || fd.collectSearchTask?.trim() || '',
        }));
        payload.lead_data = [];
      } else {
        payload.region_data = [];
        payload.lead_data = buildLeadData(fd, false);
      }
      Object.assign(payload, buildForecastPayload(fd));
    }
    return payload;
  };

  const saveCurrentStep = async () => {
    if (!campaignIdRef.current) return;
    const fd = formDataRef.current;

    const payload = buildPatchPayload(fd, currentStep);
    setSaveStatus('saving');
    try {
      await updateCampaign.mutateAsync(payload);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
      message.error('Ошибка при сохранении');
      throw new Error('save failed');
    }
  };

  const handleNext = async () => {
    if (currentStep === 0 && !formData.name.trim()) {
      message.warning('Введите название кампании');
      return;
    }
    try {
      await saveCurrentStep();
    } catch {
      return;
    }
    const stepTitles = getStepTitles(formDataRef.current.hasCollectStage);
    setCurrentStep((s) => Math.min(s + 1, stepTitles.length - 1));
  };

  const handlePrev = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleStepClick = async (step: number) => {
    if (step === currentStep) return;
    if (step === 0 && !formData.name.trim()) {
      setCurrentStep(step);
      return;
    }
    if (step > currentStep) {
      // Going forward — save current step first
      try {
        await saveCurrentStep();
      } catch {
        return;
      }
    }
    setCurrentStep(step);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      message.error('Укажите название кампании');
      return;
    }
    setSubmitting(true);
    try {
      const leadData = buildLeadData(formData, true);

      const payload = {
        name: formData.name,
        federal_operator: formData.federal_operator,
        federal_operator_ids: formData.federal_operator_ids,
        project: formData.project,
        acting_organization: formData.acting_organization,
        collect_search_task: formData.collectSearchTask,
        hypothesis: formData.hypothesis,
        tags: formData.tagIds,
        status: 'active',
        has_collect_stage: formData.hasCollectStage,
        funnel_ids: formData.selectedFunnels,
        queues: formData.queues.map((q) => ({
          queue_number: q.queue_number,
          name: q.name,
          start_date: q.start_date,
          end_date: q.end_date,
          stage_deadlines: q.stage_deadlines,
        })),
        program_ids: formData.selectedPrograms,
        region_data: formData.hasCollectStage
          ? formData.regionData.map((rd) => ({
              ...rd,
              queue_number: rd.queue_number ?? 1,
              search_task: rd.search_task?.trim() || formData.collectSearchTask?.trim() || '',
            }))
          : [],
        organization_ids: formData.selectedOrganizations,
        lead_data: leadData,
        manager_assignments: formData.managerAssignments,
        ...buildForecastPayload(formData),
      };

      let resultId: number;
      if (campaignId) {
        await updateCampaign.mutateAsync(payload);
        resultId = campaignId;
      } else {
        const result = await createCampaign.mutateAsync(payload);
        resultId = result.id;
      }

      message.success('Кампания сохранена');
      navigate(`/campaigns/${resultId}`);
    } catch (err: any) {
      message.error('Ошибка при сохранении кампании');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const stepComponents = [
    <StepBasicInfo data={formData} onChange={updateFormData} />,
    <StepPrograms data={formData} onChange={updateFormData} />,
    formData.hasCollectStage
      ? <StepRegions data={formData} onChange={updateFormData} />
      : <StepOrganizations data={formData} onChange={updateFormData} />,
    <StepManagers data={formData} onChange={updateFormData} />,
    <StepReview data={formData} />,
  ];
  const stepTitles = getStepTitles(formData.hasCollectStage);

  const SaveIndicator = () => {
    if (saveStatus === 'saving') {
      return (
        <Space size={4}>
          <Spin size="small" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Сохранение...</Typography.Text>
        </Space>
      );
    }
    if (saveStatus === 'saved') {
      return (
        <Space size={4}>
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Сохранено</Typography.Text>
        </Space>
      );
    }
    if (campaignId) {
      return (
        <Space size={4}>
          <SaveOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Черновик #{campaignId}
          </Typography.Text>
        </Space>
      );
    }
    return null;
  };

  if (isEditMode && loadingCampaign && !initialLoaded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}>
        <Spin size="large" tip="Загрузка кампании..." />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }} align="center">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/campaigns')}>
          Назад
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {isEditMode ? `Редактирование: ${formData.name || '...'}` : 'Новая кампания по сбору потребности'}
        </Typography.Title>
        <SaveIndicator />
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Steps
          current={currentStep}
          size="small"
          onChange={handleStepClick}
          style={{ cursor: 'pointer' }}
          items={stepTitles.map((title, idx) => {
            const valid = getStepValid(formData);
            const needsCheck = idx <= 2; // steps 0-2 have min requirements
            const isDone = needsCheck && valid[idx];
            const isWarn = needsCheck && !valid[idx] && idx < currentStep;
            return {
              title,
              icon: isWarn
                ? <Tooltip title="Шаг не заполнен"><WarningOutlined style={{ color: '#faad14' }} /></Tooltip>
                : isDone && idx !== currentStep
                  ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  : undefined,
            };
          })}
        />
      </Card>

      <Card style={{ marginBottom: 16, minHeight: 400 }}>
        {stepComponents[currentStep]}
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={handlePrev} disabled={currentStep === 0}>
            Назад
          </Button>
          <Space>
            {currentStep < stepTitles.length - 1 ? (
              <Button type="primary" onClick={handleNext}>
                Далее
              </Button>
            ) : (() => {
                const valid = getStepValid(formData);
                const allValid = valid[0] && valid[1] && valid[2];
                const missingSteps = [
                  'Основное (название, ФО, воронка)',
                  'Программы (мин. 1)',
                  formData.hasCollectStage ? 'Регионы (мин. 1)' : 'Организации (мин. 1)',
                ]
                  .filter((_, i) => !valid[i]);
                return (
                  <Tooltip
                    title={!allValid ? `Не заполнено: ${missingSteps.join('; ')}` : undefined}
                  >
                    <Button
                      type="primary"
                      icon={<RocketOutlined />}
                      onClick={handleSubmit}
                      loading={submitting}
                      disabled={!allValid}
                    >
                      Запустить в работу
                    </Button>
                  </Tooltip>
                );
              })()}
          </Space>
        </div>
      </Card>
    </div>
  );
}

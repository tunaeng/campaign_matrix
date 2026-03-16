import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Steps, Button, Space, Typography, App, Spin, Tooltip } from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined,
  WarningOutlined, RocketOutlined,
} from '@ant-design/icons';
import {
  useCreateCampaign, useUpdateCampaign, useCampaign, useSyncExternalOrganizations,
} from '../../api/hooks';
import StepBasicInfo from './steps/StepBasicInfo';
import StepPrograms from './steps/StepPrograms';
import StepOrganizations from './steps/StepOrganizations';
import StepManagers from './steps/StepManagers';
import StepReview from './steps/StepReview';
import type { ExternalOrganization } from '../../types';

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
  hypothesis: string;
  selectedFunnels: number[];
  selectedPrograms: number[];
  queues: QueueFormData[];
  regionData: { region_id: number; queue_number: number | null; manager_id: number | null }[];
  selectedOrganizations: number[];
  selectedExternalOrgs: ExternalOrganization[];
  orgQueueAssignments: Record<string, number>;
  orgFunnelAssignments: Record<string, number>;
  profActivityList: string[];
  orgDistribution: Record<string, OrgDistributionItem>;
  managerAssignments: { level: string; target_id: number; manager_id: number }[];
  forecastDemandMode: ForecastDemandMode;
  forecastDemandTotal: number | null;
  forecastDemandPerQueue: Record<number, number | null>;
}

const initialData: CampaignFormData = {
  name: '',
  federal_operator: null,
  hypothesis: '',
  selectedFunnels: [],
  selectedPrograms: [],
  queues: [{ queue_number: 1, name: 'Очередь 1', start_date: null, end_date: null, stage_deadlines: [] }],
  regionData: [],
  selectedOrganizations: [],
  selectedExternalOrgs: [],
  orgQueueAssignments: {},
  orgFunnelAssignments: {},
  profActivityList: [],
  orgDistribution: {},
  managerAssignments: [],
  forecastDemandMode: 'total',
  forecastDemandTotal: null,
  forecastDemandPerQueue: {},
};

const STEP_TITLES = ['Основное', 'Программы', 'Организации', 'Распределение', 'Обзор'];

function getStepValid(fd: CampaignFormData): boolean[] {
  return [
    !!(fd.name.trim() && fd.federal_operator && fd.selectedFunnels.length > 0),
    fd.selectedPrograms.length >= 1,
    fd.selectedExternalOrgs.length >= 1,
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
  const syncOrgs = useSyncExternalOrganizations();

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<CampaignFormData>(initialData);
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

    // Reconstruct selectedExternalOrgs from saved leads
    const leads = existingCampaign.leads ?? [];
    const selectedExternalOrgs: ExternalOrganization[] = leads.map((lead) => ({
      name: lead.organization_name,
      full_name: lead.organization_name,
      type: '',
      region: lead.organization_region || '',
      federal_company: false,
      fed_district: '',
      prof_activity: '',
      projects: [],
      is_active: true,
      created_at: '',
      updated_at: '',
    }));

    // Reconstruct per-org queue assignments
    const orgQueueAssignments: Record<string, number> = {};
    for (const lead of leads) {
      orgQueueAssignments[lead.organization_name] =
        lead.queue ? (queueIdToNumber[lead.queue] ?? 1) : 1;
    }

    // Reconstruct orgDistribution (manager per org; programs default to campaign programs)
    const orgDistribution: Record<string, OrgDistributionItem> = {};
    for (const lead of leads) {
      orgDistribution[lead.organization_name] = {
        programIds: [...selectedPrograms],
        managerId: lead.manager ?? null,
        manuallySetManager: lead.manager !== null,
        profActivity: null,
        manuallySetProfActivity: false,
        forecastDemand: lead.forecast_demand ?? null,
      };
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
        forecastDemandTotal = demandValues[0]!;
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
            forecastDemandPerQueue[Number(qNum)] = vals[0] ?? null;
          }
        } else {
          forecastDemandMode = 'per_org';
        }
      }
    }

    setFormData({
      name: existingCampaign.name,
      federal_operator: existingCampaign.federal_operator,
      hypothesis: existingCampaign.hypothesis || '',
      selectedFunnels: existingCampaign.campaign_funnels?.map((cf) => cf.funnel) ?? [],
      selectedPrograms,
      queues: existingCampaign.queues?.length
        ? existingCampaign.queues.map((q) => ({
            queue_number: q.queue_number,
            name: q.name,
            start_date: q.start_date,
            end_date: q.end_date,
            stage_deadlines: [],
          }))
        : initialData.queues,
      regionData: [],
      selectedOrganizations: [],
      selectedExternalOrgs,
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

  const nameTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const updateFormData = (partial: Partial<CampaignFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
  };

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
        });
        setCampaignId(result.id);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 700);

    return () => clearTimeout(nameTimerRef.current);
  }, [formData.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build PATCH payload for the given step (accumulates all steps up to current)
  const buildPatchPayload = (fd: CampaignFormData, upToStep: number) => {
    const payload: Record<string, any> = {
      name: fd.name,
      federal_operator: fd.federal_operator,
      hypothesis: fd.hypothesis,
    };
    if (upToStep >= 0) {
      payload.funnel_ids = fd.selectedFunnels;
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
      payload.lead_data = fd.selectedExternalOrgs.map((org) => {
        const dist = fd.orgDistribution[org.name];
        const qNum = fd.orgQueueAssignments[org.name] || 1;
        let demand: number | null = null;
        if (fd.forecastDemandMode === 'total') {
          demand = fd.forecastDemandTotal;
        } else if (fd.forecastDemandMode === 'per_queue') {
          demand = fd.forecastDemandPerQueue[qNum] ?? null;
        } else {
          demand = dist?.forecastDemand ?? null;
        }
        return {
          organization_name: org.full_name || org.name,
          funnel_id: fd.orgFunnelAssignments[org.name] || fd.selectedFunnels[0] || null,
          queue_number: qNum,
          manager_id: dist?.managerId || null,
          forecast_demand: demand,
        };
      });
    }
    return payload;
  };

  const saveCurrentStep = async () => {
    if (!campaignIdRef.current) return;
    const fd = formDataRef.current;

    // When leaving step 2 (Organizations), sync external orgs to DB first
    if (currentStep === 2 && fd.selectedExternalOrgs.length > 0) {
      try {
        await syncOrgs.mutateAsync({ organizations: fd.selectedExternalOrgs });
      } catch {
        // Non-fatal — lead_data uses organization_name fallback
      }
    }

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
    setCurrentStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
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
      // Sync external orgs to local DB first
      if (formData.selectedExternalOrgs.length > 0) {
        await syncOrgs.mutateAsync({ organizations: formData.selectedExternalOrgs });
      }

      const leadData = formData.selectedExternalOrgs.map((org) => {
        const dist = formData.orgDistribution[org.name];
        const qNum = formData.orgQueueAssignments[org.name] || 1;
        let demand: number | null = null;
        if (formData.forecastDemandMode === 'total') {
          demand = formData.forecastDemandTotal;
        } else if (formData.forecastDemandMode === 'per_queue') {
          demand = formData.forecastDemandPerQueue[qNum] ?? null;
        } else {
          demand = dist?.forecastDemand ?? null;
        }
        return {
          organization_name: org.full_name || org.name,
          funnel_id: formData.orgFunnelAssignments[org.name] || formData.selectedFunnels[0],
          queue_number: qNum,
          manager_id: dist?.managerId || null,
          program_ids: dist?.programIds ?? formData.selectedPrograms,
          forecast_demand: demand,
        };
      });

      const payload = {
        name: formData.name,
        federal_operator: formData.federal_operator,
        hypothesis: formData.hypothesis,
        status: 'active',
        funnel_ids: formData.selectedFunnels,
        queues: formData.queues.map((q) => ({
          queue_number: q.queue_number,
          name: q.name,
          start_date: q.start_date,
          end_date: q.end_date,
          stage_deadlines: q.stage_deadlines,
        })),
        program_ids: formData.selectedPrograms,
        region_data: formData.regionData,
        organization_ids: formData.selectedOrganizations,
        lead_data: leadData,
        manager_assignments: formData.managerAssignments,
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
    <StepOrganizations data={formData} onChange={updateFormData} />,
    <StepManagers data={formData} onChange={updateFormData} />,
    <StepReview data={formData} />,
  ];

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
          items={STEP_TITLES.map((title, idx) => {
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
            {currentStep < STEP_TITLES.length - 1 ? (
              <Button type="primary" onClick={handleNext}>
                Далее
              </Button>
            ) : (() => {
                const valid = getStepValid(formData);
                const allValid = valid[0] && valid[1] && valid[2];
                const missingSteps = ['Основное (название, ФО, воронка)', 'Программы (мин. 1)', 'Организации (мин. 1)']
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

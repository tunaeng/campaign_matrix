import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Steps, Button, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useCreateCampaign } from '../../api/hooks';
import StepBasicInfo from './steps/StepBasicInfo';
import StepPrograms from './steps/StepPrograms';
import StepRegions from './steps/StepRegions';
import StepOrganizations from './steps/StepOrganizations';
import StepManagers from './steps/StepManagers';
import StepReview from './steps/StepReview';

export interface CampaignFormData {
  name: string;
  federal_operator: number | null;
  hypothesis: string;
  forecast_demand: number | null;
  deadline: string | null;
  selectedPrograms: number[];
  queues: { queue_number: number; name: string; start_date: string | null; end_date: string | null }[];
  regionData: { region_id: number; queue_number: number | null; manager_id: number | null }[];
  selectedOrganizations: number[];
  managerAssignments: { level: string; target_id: number; manager_id: number }[];
}

const initialData: CampaignFormData = {
  name: '',
  federal_operator: null,
  hypothesis: '',
  forecast_demand: null,
  deadline: null,
  selectedPrograms: [],
  queues: [{ queue_number: 1, name: 'Очередь 1', start_date: null, end_date: null }],
  regionData: [],
  selectedOrganizations: [],
  managerAssignments: [],
};

const steps = [
  { title: 'Основное' },
  { title: 'Программы' },
  { title: 'Регионы' },
  { title: 'Заказчики' },
  { title: 'Менеджеры' },
  { title: 'Обзор' },
];

export default function CampaignCreatePage() {
  const navigate = useNavigate();
  const createCampaign = useCreateCampaign();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<CampaignFormData>(initialData);
  const [submitting, setSubmitting] = useState(false);

  const updateFormData = (partial: Partial<CampaignFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
  };

  const next = () => setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      message.error('Укажите название кампании');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        federal_operator: formData.federal_operator,
        hypothesis: formData.hypothesis,
        forecast_demand: formData.forecast_demand,
        deadline: formData.deadline,
        status: 'draft',
        queues: formData.queues,
        program_ids: formData.selectedPrograms,
        region_data: formData.regionData,
        organization_ids: formData.selectedOrganizations,
        manager_assignments: formData.managerAssignments,
      };
      const result = await createCampaign.mutateAsync(payload);
      message.success('Кампания создана');
      navigate(`/campaigns/${result.id}`);
    } catch (err: any) {
      message.error('Ошибка при создании кампании');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const stepComponents = [
    <StepBasicInfo data={formData} onChange={updateFormData} />,
    <StepPrograms data={formData} onChange={updateFormData} />,
    <StepRegions data={formData} onChange={updateFormData} />,
    <StepOrganizations data={formData} onChange={updateFormData} />,
    <StepManagers data={formData} onChange={updateFormData} />,
    <StepReview data={formData} />,
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/campaigns')}>
          Назад
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Новая кампания по сбору потребности
        </Typography.Title>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Steps current={currentStep} items={steps} size="small" />
      </Card>

      <Card style={{ marginBottom: 16, minHeight: 400 }}>
        {stepComponents[currentStep]}
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={prev} disabled={currentStep === 0}>
            Назад
          </Button>
          <Space>
            {currentStep < steps.length - 1 ? (
              <Button type="primary" onClick={next}>
                Далее
              </Button>
            ) : (
              <Button type="primary" onClick={handleSubmit} loading={submitting}>
                Создать кампанию
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
}

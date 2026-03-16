import { Form, Input, Select, Typography, Tag } from 'antd';
import { useFederalOperators, useFunnels } from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
}

export default function StepBasicInfo({ data, onChange }: Props) {
  const { data: operators } = useFederalOperators();
  const { data: funnels } = useFunnels({ is_active: true });

  return (
    <div style={{ maxWidth: 600 }}>
      <Typography.Title level={5}>Основные параметры кампании</Typography.Title>

      <Form layout="vertical" size="large">
        <Form.Item label="Название кампании" required>
          <Input
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Например: Сбор потребности Минздрав ЦФО Q1"
          />
        </Form.Item>

        <Form.Item label="Федеральный оператор">
          <Select
            value={data.federal_operator}
            onChange={(v) => onChange({ federal_operator: v })}
            placeholder="Выберите ФО"
            allowClear
            options={(operators?.results || []).map((op) => ({
              value: op.id,
              label: op.short_name?.trim() || op.name,
            }))}
          />
        </Form.Item>

        <Form.Item label="Воронка (сценарий)">
          <Select
            value={data.selectedFunnels[0] ?? null}
            onChange={(v) => onChange({ selectedFunnels: v != null ? [v] : [] })}
            placeholder="Выберите воронку"
            allowClear
            options={(funnels?.results || []).map((f) => ({
              value: f.id,
              label: f.name,
            }))}
          />
          {data.selectedFunnels.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {(funnels?.results || [])
                .filter(f => data.selectedFunnels.includes(f.id))
                .map(f => (
                  <Tag key={f.id} color="blue" style={{ marginBottom: 4 }}>
                    {f.name} — {f.stages_count || 0} стадий
                  </Tag>
                ))}
            </div>
          )}
        </Form.Item>

        <Form.Item label="Гипотеза">
          <Input.TextArea
            value={data.hypothesis}
            onChange={(e) => onChange({ hypothesis: e.target.value })}
            rows={4}
            placeholder="Описание гипотезы: почему это должно сработать, зачем заказчику обучение, ожидания по потребности..."
          />
        </Form.Item>
      </Form>
    </div>
  );
}

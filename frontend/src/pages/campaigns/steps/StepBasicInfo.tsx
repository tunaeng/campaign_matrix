import { Form, Input, Select, InputNumber, DatePicker, Typography } from 'antd';
import { useFederalOperators } from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';
import dayjs from 'dayjs';

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
}

export default function StepBasicInfo({ data, onChange }: Props) {
  const { data: operators } = useFederalOperators();

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
              label: op.name,
            }))}
          />
        </Form.Item>

        <Form.Item label="Гипотеза">
          <Input.TextArea
            value={data.hypothesis}
            onChange={(e) => onChange({ hypothesis: e.target.value })}
            rows={4}
            placeholder="Описание гипотезы: почему это должно сработать, зачем заказчику обучение, ожидания по потребности..."
          />
        </Form.Item>

        <Form.Item label="Прогноз потребности (чел.)">
          <InputNumber
            value={data.forecast_demand}
            onChange={(v) => onChange({ forecast_demand: v })}
            min={0}
            style={{ width: '100%' }}
            placeholder="Ожидаемое количество человек"
          />
        </Form.Item>

        <Form.Item label="Дедлайн">
          <DatePicker
            value={data.deadline ? dayjs(data.deadline) : null}
            onChange={(d) => onChange({ deadline: d ? d.format('YYYY-MM-DD') : null })}
            style={{ width: '100%' }}
            format="DD.MM.YYYY"
          />
        </Form.Item>
      </Form>
    </div>
  );
}

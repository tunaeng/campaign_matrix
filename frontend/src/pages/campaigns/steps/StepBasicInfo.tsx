import { useEffect, useMemo } from 'react';
import { Form, Input, Select, Typography, Tag, Switch } from 'antd';
import {
  useFederalOperators, useFunnels, useProjects, useMyActingOrganizations, useOrganizationTags, useFunnel,
} from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';
import EntityTagSelect from '../../../components/EntityTagSelect';

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
}

export default function StepBasicInfo({ data, onChange }: Props) {
  const { data: operators } = useFederalOperators(
    data.project ? { project: data.project } : undefined
  );
  const { data: projects } = useProjects({ page_size: 500 });
  const { data: myActingOrganizations } = useMyActingOrganizations();
  const { data: funnels } = useFunnels({ is_active: true });
  const { data: allTags } = useOrganizationTags({ page_size: 500, tag_type: 'campaigns' });
  const selectedFunnelId = data.selectedFunnels[0] ?? 0;
  const { data: selectedFunnel } = useFunnel(selectedFunnelId);
  const collectStage = useMemo(
    () => selectedFunnel?.stages?.find((s) => s.is_collect_stage),
    [selectedFunnel],
  );
  const collectStageAvailable = !!collectStage;
  const operatorOptions = (operators?.results || []).map((op) => ({
    value: op.id,
    label: op.short_name?.trim() || op.name,
  }));

  useEffect(() => {
    if (!data.federal_operator_ids?.length) return;
    const allowed = new Set(operatorOptions.map((op) => op.value));
    const filtered = data.federal_operator_ids.filter((id) => allowed.has(id));
    if (filtered.length === data.federal_operator_ids.length) return;
    onChange({
      federal_operator_ids: filtered,
      federal_operator: filtered[0] ?? null,
    });
  }, [data.federal_operator_ids, data.project, operatorOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!collectStageAvailable && data.hasCollectStage) {
      onChange({ hasCollectStage: false });
    }
  }, [collectStageAvailable, data.hasCollectStage]); // eslint-disable-line react-hooks/exhaustive-deps

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

        <Form.Item label="Проект">
          <Select
            value={data.project}
            onChange={(v) => onChange({ project: v })}
            placeholder="Выберите проект"
            allowClear
            options={(projects?.results || []).map((p) => ({
              value: p.id,
              label: `${p.name} (${p.year})`,
            }))}
          />
        </Form.Item>

        <Form.Item label="Федеральный оператор">
          <Select
            mode="multiple"
            value={data.federal_operator_ids}
            onChange={(v) => onChange({ federal_operator_ids: v, federal_operator: v[0] ?? null })}
            placeholder={data.project ? 'Выберите ФО' : 'Сначала выберите проект'}
            allowClear
            disabled={!data.project}
            options={operatorOptions}
          />
        </Form.Item>

        <Form.Item label="От какой организации ведётся кампания">
          <Select
            value={data.acting_organization}
            onChange={(v) => onChange({ acting_organization: v })}
            placeholder="Выберите вашу организацию"
            allowClear
            options={(myActingOrganizations || []).map((row) => ({
              value: row.organization,
              label: `${row.organization_name} (${row.organization_inn})`,
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

        <Form.Item
          label="Нулевая стадия"
          extra={
            collectStageAvailable
              ? 'В выбранной воронке есть стадия «Сбор и добавление лидов». Ее можно включать/отключать для этой кампании.'
              : 'В выбранной воронке нет настроенной нулевой стадии. Добавьте ее в настройках воронки.'
          }
        >
          <Switch
            checked={collectStageAvailable && data.hasCollectStage}
            disabled={!collectStageAvailable}
            onChange={(checked) => onChange({ hasCollectStage: checked })}
          />
        </Form.Item>

        <Form.Item label="Теги">
          <EntityTagSelect
            availableTags={allTags?.results ?? []}
            value={data.tagIds}
            onChange={(tagIds) => onChange({ tagIds })}
            placeholder="Выберите теги"
            style={{ width: '100%' }}
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
      </Form>
    </div>
  );
}

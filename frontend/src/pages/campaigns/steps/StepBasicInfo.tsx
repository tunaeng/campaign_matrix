import { useEffect, useMemo, useRef } from 'react';
import { Form, Input, Select, Typography, Tag, Switch } from 'antd';
import {
  useFederalOperators, useFunnels, useProjects, useMyActingOrganizations, useOrganizationTags, useFunnel, useUsers,
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
  const { data: users } = useUsers();
  const selectedFunnelId = data.selectedFunnels[0] ?? 0;
  const { data: selectedFunnel, isFetched: funnelFetched } = useFunnel(selectedFunnelId);
  const collectStage = useMemo(
    () => selectedFunnel?.stages?.find((s) => s.is_collect_stage),
    [selectedFunnel],
  );
  const collectStageAvailable = !!collectStage;
  const defaultsAppliedRef = useRef(false);
  const operatorOptions = (operators?.results || []).map((op) => ({
    value: op.id,
    label: op.short_name?.trim() || op.name,
  }));

  useEffect(() => {
    if (!data.federal_operator_ids?.length) return;
    if (!data.project) return;
    if (!operators?.results) return;
    const allowed = new Set(operatorOptions.map((op) => op.value));
    const filtered = data.federal_operator_ids.filter((id) => allowed.has(id));
    if (filtered.length === data.federal_operator_ids.length) return;
    onChange({
      federal_operator_ids: filtered,
      federal_operator: filtered[0] ?? null,
    });
  }, [data.federal_operator_ids, data.project, operators?.results, operatorOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projects?.results && !funnels?.results && !myActingOrganizations) return;
    if (defaultsAppliedRef.current) return;

    const updates: Partial<CampaignFormData> = {};
    const projectList = projects?.results || [];
    const funnelList = funnels?.results || [];
    const actingList = myActingOrganizations || [];

    if (data.project == null && projectList.length > 0) {
      const currentYear = new Date().getFullYear();
      const sorted = [...projectList].sort((a, b) => b.year - a.year);
      updates.project = sorted.find((p) => p.year === currentYear)?.id ?? sorted[0].id;
    }

    if (data.acting_organization == null && actingList.length > 0) {
      const primary = actingList.find((row) => row.is_primary);
      updates.acting_organization = (primary ?? actingList[0]).organization;
    }

    if (data.selectedFunnels.length === 0 && funnelList.length > 0) {
      const withCollectStage = funnelList.find((f) => /нулев/i.test(f.name));
      updates.selectedFunnels = [withCollectStage?.id ?? funnelList[0].id];
    }

    defaultsAppliedRef.current = true;
    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
  }, [projects, funnels, myActingOrganizations, data.project, data.acting_organization, data.selectedFunnels]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedFunnelId || !funnelFetched) return;
    if (!collectStageAvailable && data.hasCollectStage) {
      onChange({ hasCollectStage: false });
    }
  }, [collectStageAvailable, data.hasCollectStage, selectedFunnelId, funnelFetched]); // eslint-disable-line react-hooks/exhaustive-deps

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

        <Form.Item label="Ответственный за кампанию">
          <Select
            value={data.responsible}
            onChange={(v) => onChange({ responsible: v ?? null })}
            placeholder="Выберите ответственного"
            allowClear
            showSearch
            optionFilterProp="label"
            options={(users?.results || []).map((u) => ({
              value: u.id,
              label: u.full_name?.trim() || u.username,
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

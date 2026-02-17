import { useState } from 'react';
import { Table, Select, Space, Typography, Input, Tag, Switch } from 'antd';
import { useOrganizations } from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';
import type { Organization } from '../../../types';

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
}

const orgTypeOptions = [
  { value: 'ministry', label: 'Министерство/ведомство' },
  { value: 'enterprise', label: 'Предприятие' },
  { value: 'education', label: 'Образовательная организация' },
  { value: 'healthcare', label: 'Учреждение здравоохранения' },
  { value: 'municipal', label: 'Муниципальное учреждение' },
  { value: 'other', label: 'Другое' },
];

export default function StepOrganizations({ data, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [orgType, setOrgType] = useState<string>();
  const [hasHistory, setHasHistory] = useState(false);

  const regionIds = data.regionData.map((rd) => rd.region_id);

  const { data: orgs, isLoading } = useOrganizations({
    search: search || undefined,
    org_type: orgType,
    has_history: hasHistory ? 'true' : undefined,
    region_ids: regionIds.length > 0 ? regionIds.join(',') : undefined,
  });

  const columns = [
    {
      title: 'Организация',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Тип',
      dataIndex: 'org_type_display',
      key: 'type',
      width: 200,
    },
    {
      title: 'Регион',
      dataIndex: 'region_name',
      key: 'region',
      width: 200,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'История',
      key: 'history',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: Organization) =>
        record.has_interaction_history ? (
          <Tag color="green">Есть</Tag>
        ) : (
          <Tag>Нет</Tag>
        ),
    },
    {
      title: 'Посл. контакт',
      dataIndex: 'last_interaction_date',
      key: 'last_date',
      width: 120,
      render: (v: string | null) => v || '—',
    },
  ];

  return (
    <div>
      <Typography.Title level={5}>Выбор заказчиков</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {regionIds.length > 0
          ? `Показаны организации из выбранных регионов (${regionIds.length}). Используйте фильтры для уточнения.`
          : 'Выберите регионы на предыдущем шаге для фильтрации организаций по территории.'}
      </Typography.Text>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="Поиск организации"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />
        <Select
          placeholder="Тип организации"
          allowClear
          style={{ width: 250 }}
          value={orgType}
          onChange={setOrgType}
          options={orgTypeOptions}
        />
        <Space>
          <Switch checked={hasHistory} onChange={setHasHistory} size="small" />
          <Typography.Text>Только с историей взаимодействия</Typography.Text>
        </Space>
      </Space>

      <Table
        dataSource={orgs?.results || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 15, showTotal: (t) => `Всего: ${t}` }}
        rowSelection={{
          selectedRowKeys: data.selectedOrganizations,
          onChange: (keys) => onChange({ selectedOrganizations: keys as number[] }),
        }}
      />

      {data.selectedOrganizations.length > 0 && (
        <Typography.Text style={{ marginTop: 8, display: 'block' }}>
          Выбрано организаций: <strong>{data.selectedOrganizations.length}</strong>
        </Typography.Text>
      )}
    </div>
  );
}

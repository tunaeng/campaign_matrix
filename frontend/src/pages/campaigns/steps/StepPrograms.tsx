import { useState, useEffect, useMemo } from 'react';
import { Table, Tag, Select, Space, Typography, Input, Switch, Popover } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, FileOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { usePrograms, useFederalOperators, useProfessions, useDemandMatrix } from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';
import type { Program } from '../../../types';

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
}

const contractStatusIcons: Record<string, React.ReactNode> = {
  approved: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  in_appendix: <ClockCircleOutlined style={{ color: '#1677ff' }} />,
  draft_appendix: <FileOutlined style={{ color: '#faad14' }} />,
};

export default function StepPrograms({ data, onChange }: Props) {
  const { data: operators } = useFederalOperators();
  const { data: professionsData } = useProfessions();
  const [search, setSearch] = useState('');
  const [contractFilter, setContractFilter] = useState<string>();
  const [operatorFilter, setOperatorFilter] = useState<number | undefined>(
    data.federal_operator ?? undefined
  );
  const [professionFilter, setProfessionFilter] = useState<number | undefined>();
  const [demandedOnly, setDemandedOnly] = useState(false);
  const [demandRegionFilter, setDemandRegionFilter] = useState<number[]>([]);

  useEffect(() => {
    if (data.federal_operator && !operatorFilter) {
      setOperatorFilter(data.federal_operator);
    }
  }, [data.federal_operator]);

  const { data: programs, isLoading } = usePrograms({
    search: search || undefined,
    contract_status: contractFilter,
    operator: operatorFilter,
    profession: professionFilter,
    demanded_only: demandedOnly || undefined,
  });

  const { data: demandMatrix } = useDemandMatrix(
    operatorFilter ? { federal_operator: operatorFilter } : undefined,
  );

  // profession_id -> { count, regionNames }
  const demandByProfession = useMemo(() => {
    if (!demandMatrix) return {} as Record<number, { count: number; regions: string[] }>;
    const map: Record<number, { count: number; regions: string[] }> = {};
    for (const prof of demandMatrix.professions) {
      const demanded = demandMatrix.regions
        .filter((r) => prof.regions[String(r.id)])
        .map((r) => r.name);
      map[prof.profession_id] = { count: demanded.length, regions: demanded };
    }
    return map;
  }, [demandMatrix]);

  const regionOptions = useMemo(
    () => (demandMatrix?.regions || []).map((r) => ({ value: r.id, label: r.name })),
    [demandMatrix],
  );

  let allPrograms = programs?.results || [];

  // extra client-side filter: must be demanded in ALL selected regions
  if (demandRegionFilter.length > 0) {
    allPrograms = allPrograms.filter((p) => {
      const prof = demandMatrix?.professions.find((pr) => pr.profession_id === p.profession);
      if (!prof) return false;
      return demandRegionFilter.every((rid) => prof.regions[String(rid)] === true);
    });
  }

  const columns = [
    {
      title: 'Программа',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Профессия',
      key: 'profession',
      width: 200,
      render: (_: any, record: Program) => (
        <span>{record.profession_number}. {record.profession_name}</span>
      ),
    },
    {
      title: 'Статус в договорах',
      key: 'contract',
      width: 200,
      render: (_: any, record: Program) => {
        if (!record.contract_status.length) {
          return <Tag>Не в договоре</Tag>;
        }
        return (
          <Space direction="vertical" size={2}>
            {record.contract_status.map((cs, i) => (
              <Tag key={i} icon={contractStatusIcons[cs.status]}>
                {cs.status_display}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Часов',
      dataIndex: 'hours',
      key: 'hours',
      width: 80,
      render: (v: number | null) => v ?? '—',
    },
    {
      title: (
        <Space size={4}>
          <EnvironmentOutlined />
          <span>Востребованность</span>
        </Space>
      ),
      key: 'demand',
      width: 150,
      render: (_: any, record: Program) => {
        const info = demandByProfession[record.profession];
        if (!demandMatrix) return <Tag color="default">—</Tag>;
        if (!info || info.count === 0) {
          return <Tag color="default">0 регионов</Tag>;
        }
        return (
          <Popover
            title="Регионы с востребованностью"
            content={
              <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 240, overflow: 'auto', minWidth: 180 }}>
                {info.regions.map((r) => <li key={r}>{r}</li>)}
              </ul>
            }
            placement="left"
          >
            <Tag
              color="green"
              icon={<EnvironmentOutlined />}
              style={{ cursor: 'pointer' }}
            >
              {info.count} рег.
            </Tag>
          </Popover>
        );
      },
    },
  ];

  const selectedRowKeys = data.selectedPrograms;

  return (
    <div>
      <Typography.Title level={5}>Выбор программ обучения</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Выберите программы для включения в кампанию. Используйте фильтры для поиска по статусу в договорах и востребованности.
      </Typography.Text>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="Поиск программы"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
        <Select
          placeholder="Профессия"
          allowClear
          showSearch
          filterOption={(input, option) =>
            (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: 280 }}
          value={professionFilter}
          onChange={setProfessionFilter}
          options={(professionsData?.results || []).map((p) => ({
            value: p.id,
            label: `${p.number}. ${p.name}`,
          }))}
        />
        <Select
          placeholder="Статус в договоре"
          allowClear
          style={{ width: 200 }}
          value={contractFilter}
          onChange={setContractFilter}
          options={[
            { value: 'approved', label: 'Утверждена в договоре' },
            { value: 'in_appendix', label: 'В приложении' },
            { value: 'draft_appendix', label: 'В проекте приложения' },
          ]}
        />
        <Select
          placeholder="Федеральный оператор"
          allowClear
          style={{ width: 250 }}
          value={operatorFilter}
          onChange={setOperatorFilter}
          options={(operators?.results || []).map((op) => ({
            value: op.id,
            label: op.short_name?.trim() || op.name,
          }))}
        />
        <Select
          mode="multiple"
          placeholder="Востребована в регионах..."
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ minWidth: 240 }}
          value={demandRegionFilter}
          onChange={setDemandRegionFilter}
          options={regionOptions}
          maxTagCount={2}
          maxTagPlaceholder={(omitted) => `+${omitted.length}`}
          disabled={!demandMatrix}
        />
        <Space>
          <Switch checked={demandedOnly} onChange={setDemandedOnly} size="small" />
          <Typography.Text>Только с востребованностью</Typography.Text>
        </Space>
      </Space>

      <Table
        dataSource={allPrograms}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 15, showTotal: (t) => `Всего: ${t}` }}
        onRow={(record) => ({
          onClick: () => {
            const id = record.id;
            const isSelected = selectedRowKeys.includes(id);
            const next = isSelected
              ? selectedRowKeys.filter((k) => k !== id)
              : [...selectedRowKeys, id];
            onChange({ selectedPrograms: next });
          },
          style: { cursor: 'pointer' },
        })}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => onChange({ selectedPrograms: keys as number[] }),
        }}
      />

      {selectedRowKeys.length > 0 && (
        <Typography.Text style={{ marginTop: 8, display: 'block' }}>
          Выбрано программ: <strong>{selectedRowKeys.length}</strong>
        </Typography.Text>
      )}
    </div>
  );
}

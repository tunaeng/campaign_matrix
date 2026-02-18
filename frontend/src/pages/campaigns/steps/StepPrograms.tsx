import { useState, useEffect } from 'react';
import { Table, Tag, Select, Space, Typography, Input, Switch } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, FileOutlined } from '@ant-design/icons';
import { usePrograms, useFederalOperators } from '../../../api/hooks';
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
  const [search, setSearch] = useState('');
  const [contractFilter, setContractFilter] = useState<string>();
  const [operatorFilter, setOperatorFilter] = useState<number | undefined>(
    data.federal_operator ?? undefined
  );
  const [demandedOnly, setDemandedOnly] = useState(false);

  useEffect(() => {
    if (data.federal_operator && !operatorFilter) {
      setOperatorFilter(data.federal_operator);
    }
  }, [data.federal_operator]);

  const { data: programs, isLoading } = usePrograms({
    search: search || undefined,
    contract_status: contractFilter,
    operator: operatorFilter,
    demanded_only: demandedOnly || undefined,
  });

  const allPrograms = programs?.results || [];

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
          style={{ width: 250 }}
          allowClear
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

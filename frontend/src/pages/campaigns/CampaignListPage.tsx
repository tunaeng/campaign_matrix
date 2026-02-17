import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Button, Space, Select, Typography, Input } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useCampaigns } from '../../api/hooks';
import type { Campaign } from '../../types';

const statusColors: Record<string, string> = {
  draft: 'default',
  active: 'processing',
  paused: 'warning',
  completed: 'success',
};

export default function CampaignListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState<string>();
  const { data, isLoading } = useCampaigns({
    status: statusFilter,
    search: search || undefined,
    page,
    ordering,
  });

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (name: string, record: Campaign) => (
        <a onClick={() => navigate(`/campaigns/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string, record: Campaign) => (
        <Tag color={statusColors[status]}>{record.status_display}</Tag>
      ),
    },
    {
      title: 'ФО',
      dataIndex: 'federal_operator_name',
      key: 'operator',
      width: 200,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Программ',
      dataIndex: 'programs_count',
      key: 'programs',
      width: 100,
      align: 'center' as const,
    },
    {
      title: 'Регионов',
      dataIndex: 'regions_count',
      key: 'regions',
      width: 100,
      align: 'center' as const,
    },
    {
      title: 'Заказчиков',
      dataIndex: 'organizations_count',
      key: 'orgs',
      width: 110,
      align: 'center' as const,
    },
    {
      title: 'Потребность',
      dataIndex: 'total_demand',
      key: 'demand',
      width: 120,
      align: 'center' as const,
      render: (v: number) => v || '—',
    },
    {
      title: 'Прогноз',
      dataIndex: 'forecast_demand',
      key: 'forecast',
      width: 100,
      align: 'center' as const,
      render: (v: number | null) => v ?? '—',
    },
    {
      title: 'Дедлайн',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 110,
      sorter: true,
      render: (v: string | null) => v || '—',
    },
  ];

  const handleTableChange = (pagination: any, _filters: any, sorter: any) => {
    setPage(pagination.current || 1);
    if (sorter.field && sorter.order) {
      const dir = sorter.order === 'descend' ? '-' : '';
      setOrdering(`${dir}${sorter.field}`);
    } else {
      setOrdering(undefined);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Кампании по сбору потребности
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/campaigns/new')}
        >
          Создать кампанию
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="Поиск по названию"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="Статус"
            allowClear
            style={{ width: 180 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[
              { value: 'draft', label: 'Черновик' },
              { value: 'active', label: 'В работе' },
              { value: 'paused', label: 'Приостановлена' },
              { value: 'completed', label: 'Завершена' },
            ]}
          />
        </Space>

        <Table
          dataSource={data?.results || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          onChange={handleTableChange}
          pagination={{
            current: page,
            total: data?.count,
            pageSize: 50,
            showTotal: (total) => `Всего: ${total}`,
          }}
          size="middle"
        />
      </Card>
    </div>
  );
}

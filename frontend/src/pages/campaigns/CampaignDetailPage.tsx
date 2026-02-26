import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Tabs, Table, Spin, Typography,
  Button, Space, Statistic, Row, Col, Select, App,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useCampaign, useUpdateCampaign } from '../../api/hooks';
import type { CampaignOrganization } from '../../types';

const statusColors: Record<string, string> = {
  draft: 'default',
  active: 'processing',
  paused: 'warning',
  completed: 'success',
};

const orgStatusColors: Record<string, string> = {
  pending: 'default',
  contacted: 'processing',
  interested: 'cyan',
  declined: 'error',
  demand_received: 'success',
};

export default function CampaignDetailPage() {
  const { message } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaign(id!);
  const updateCampaign = useUpdateCampaign(id!);

  const orgStatusSummary = useMemo(() => {
    if (!campaign) return {};
    const summary: Record<string, { count: number; label: string }> = {};
    for (const org of campaign.organizations) {
      if (!summary[org.status]) {
        summary[org.status] = { count: 0, label: org.status_display };
      }
      summary[org.status].count += 1;
    }
    return summary;
  }, [campaign]);

  const managerSummary = useMemo(() => {
    if (!campaign) return { programs: 0, regions: 0, organizations: 0 };
    return {
      programs: campaign.campaign_programs.filter((p) => p.manager).length,
      regions: campaign.campaign_regions.filter((r) => r.manager).length,
      organizations: campaign.organizations.filter((o) => o.manager).length,
    };
  }, [campaign]);

  if (isLoading) return <div style={{ textAlign: 'center', paddingTop: 100 }}><Spin size="large" /></div>;
  if (!campaign) return <Typography.Text>Кампания не найдена</Typography.Text>;

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateCampaign.mutateAsync({ status: newStatus });
      message.success('Статус обновлён');
    } catch {
      message.error('Ошибка обновления статуса');
    }
  };

  const programColumns = [
    { title: 'Программа', dataIndex: 'program_name', key: 'name' },
    { title: 'Профессия', dataIndex: 'profession_name', key: 'profession' },
    { title: 'Менеджер', dataIndex: 'manager_name', key: 'manager', render: (v: string | null) => v || '—' },
  ];

  const regionColumns = [
    { title: 'Регион', dataIndex: 'region_name', key: 'name' },
    { title: 'Округ', dataIndex: 'federal_district_name', key: 'district' },
    { title: 'Очередь', dataIndex: 'queue_name', key: 'queue', render: (v: string | null) => v || '—' },
    { title: 'Менеджер', dataIndex: 'manager_name', key: 'manager', render: (v: string | null) => v || '—' },
  ];

  const orgColumns = [
    { title: 'Организация', dataIndex: 'organization_name', key: 'name' },
    { title: 'Регион', dataIndex: 'organization_region', key: 'region', render: (v: string | null) => v || '—' },
    { title: 'Тип', dataIndex: 'organization_type', key: 'type' },
    {
      title: 'Статус', dataIndex: 'status', key: 'status',
      render: (status: string, record: CampaignOrganization) => (
        <Tag color={orgStatusColors[status]}>{record.status_display}</Tag>
      ),
    },
    { title: 'Потребность', dataIndex: 'demand_count', key: 'demand', align: 'center' as const },
    { title: 'Менеджер', dataIndex: 'manager_name', key: 'manager', render: (v: string | null) => v || '—' },
  ];

  const uniqueManagers = useMemo(() => {
    const managerSet = new Map<number, string>();
    for (const p of campaign.campaign_programs) {
      if (p.manager && p.manager_name) managerSet.set(p.manager, p.manager_name);
    }
    for (const r of campaign.campaign_regions) {
      if (r.manager && r.manager_name) managerSet.set(r.manager, r.manager_name);
    }
    for (const o of campaign.organizations) {
      if (o.manager && o.manager_name) managerSet.set(o.manager, o.manager_name);
    }
    return Array.from(managerSet.entries()).map(([id, name]) => ({ id, name }));
  }, [campaign]);

  const managerColumns = [
    { title: 'Менеджер', dataIndex: 'name', key: 'name' },
    {
      title: 'Программы', key: 'programs',
      render: (_: any, record: { id: number }) =>
        campaign.campaign_programs.filter((p) => p.manager === record.id).length || '—',
    },
    {
      title: 'Регионы', key: 'regions',
      render: (_: any, record: { id: number }) =>
        campaign.campaign_regions.filter((r) => r.manager === record.id).length || '—',
    },
    {
      title: 'Организации', key: 'orgs',
      render: (_: any, record: { id: number }) =>
        campaign.organizations.filter((o) => o.manager === record.id).length || '—',
    },
  ];

  const tabItems = [
    {
      key: 'programs',
      label: `Программы (${campaign.campaign_programs.length})`,
      children: (
        <Table
          dataSource={campaign.campaign_programs}
          columns={programColumns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      ),
    },
    {
      key: 'regions',
      label: `Регионы (${campaign.campaign_regions.length})`,
      children: (
        <Table
          dataSource={campaign.campaign_regions}
          columns={regionColumns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      ),
    },
    {
      key: 'organizations',
      label: `Заказчики (${campaign.organizations.length})`,
      children: (
        <div>
          {Object.keys(orgStatusSummary).length > 0 && (
            <Space wrap style={{ marginBottom: 16 }}>
              {Object.entries(orgStatusSummary).map(([status, info]) => (
                <Tag key={status} color={orgStatusColors[status]}>
                  {info.label}: {info.count}
                </Tag>
              ))}
            </Space>
          )}
          <Table
            dataSource={campaign.organizations}
            columns={orgColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 20 }}
          />
        </div>
      ),
    },
    {
      key: 'managers',
      label: `Менеджеры (${uniqueManagers.length})`,
      children: (
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col>
              <Statistic
                title="По программам"
                value={managerSummary.programs}
                suffix={`/ ${campaign.campaign_programs.length}`}
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
            <Col>
              <Statistic
                title="По регионам"
                value={managerSummary.regions}
                suffix={`/ ${campaign.campaign_regions.length}`}
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
            <Col>
              <Statistic
                title="По организациям"
                value={managerSummary.organizations}
                suffix={`/ ${campaign.organizations.length}`}
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
          </Row>
          <Table
            dataSource={uniqueManagers}
            columns={managerColumns}
            rowKey="id"
            size="small"
            pagination={false}
          />
          {uniqueManagers.length === 0 && (
            <Typography.Text type="secondary">Менеджеры пока не назначены</Typography.Text>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/campaigns')}>
          Назад
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Typography.Title level={4} style={{ marginBottom: 8 }}>
              {campaign.name}
            </Typography.Title>
            <Space>
              <Tag color={statusColors[campaign.status]}>{campaign.status_display}</Tag>
              <Select
                value={campaign.status}
                onChange={handleStatusChange}
                size="small"
                style={{ width: 160 }}
                options={[
                  { value: 'draft', label: 'Черновик' },
                  { value: 'active', label: 'В работе' },
                  { value: 'paused', label: 'Приостановлена' },
                  { value: 'completed', label: 'Завершена' },
                ]}
              />
            </Space>
          </div>
        </div>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={4}>
            <Statistic title="Потребность" value={campaign.total_demand} suffix="чел." />
          </Col>
          <Col span={4}>
            <Statistic title="Прогноз" value={campaign.forecast_demand || 0} suffix="чел." />
          </Col>
          <Col span={4}>
            <Statistic title="Заказчиков" value={campaign.organizations_count} />
          </Col>
          <Col span={4}>
            <Statistic title="Программ" value={campaign.campaign_programs.length} />
          </Col>
          <Col span={4}>
            <Statistic title="Регионов" value={campaign.campaign_regions.length} />
          </Col>
          <Col span={4}>
            <Statistic title="Менеджеров" value={uniqueManagers.length} />
          </Col>
        </Row>

        <Descriptions column={2} style={{ marginTop: 16 }} size="small">
          <Descriptions.Item label="Федеральный оператор">
            {campaign.federal_operator_name || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Дедлайн">
            {campaign.deadline || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Создал">
            {campaign.created_by_name || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Создана">
            {new Date(campaign.created_at).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
        </Descriptions>

        {campaign.hypothesis && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text strong>Гипотеза:</Typography.Text>
            <Typography.Paragraph style={{ marginTop: 4 }}>
              {campaign.hypothesis}
            </Typography.Paragraph>
          </div>
        )}

        {campaign.hypothesis_result && (
          <div style={{ marginTop: 8 }}>
            <Typography.Text strong>Результат проверки гипотезы:</Typography.Text>
            <Typography.Paragraph style={{ marginTop: 4 }}>
              {campaign.hypothesis_result}
            </Typography.Paragraph>
          </div>
        )}
      </Card>

      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}

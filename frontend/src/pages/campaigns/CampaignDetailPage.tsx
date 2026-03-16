import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Tabs, Table, Spin, Typography,
  Button, Space, Statistic, Row, Col, Select, App, Progress, Segmented,
} from 'antd';
import { ArrowLeftOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useCampaign, useUpdateCampaign } from '../../api/hooks';
import type { CampaignOrganization, Lead } from '../../types';
import LeadBoardView from './LeadBoardView';

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
  const [leadsView, setLeadsView] = useState<'table' | 'board'>('board');

  const uniqueManagers = useMemo(() => {
    if (!campaign) return [];
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
    for (const l of (campaign.leads || [])) {
      if (l.manager && l.manager_name) managerSet.set(l.manager, l.manager_name);
    }
    return Array.from(managerSet.entries()).map(([id, name]) => ({ id, name }));
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

  const leads = campaign.leads || [];
  const funnelNames = campaign.campaign_funnels?.map(f => f.funnel_name) || [];

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

  const leadColumns = [
    {
      title: 'Организация',
      dataIndex: 'organization_name',
      key: 'name',
      render: (text: string, record: Lead) => (
        <a onClick={() => navigate(`/campaigns/${id}/leads/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Регион',
      dataIndex: 'organization_region',
      key: 'region',
      width: 160,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Воронка',
      dataIndex: 'funnel_name',
      key: 'funnel',
      width: 160,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Стадия',
      dataIndex: 'current_stage_name',
      key: 'stage',
      width: 160,
      render: (v: string | null) => v ? <Tag color="processing">{v}</Tag> : <Tag>Не начата</Tag>,
    },
    {
      title: 'Прогресс',
      key: 'progress',
      width: 120,
      render: (_: any, record: Lead) => {
        if (!record.checklist_progress) return '—';
        const { completed, total } = record.checklist_progress;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        return <Progress percent={pct} size="small" format={() => `${completed}/${total}`} />;
      },
    },
    {
      title: 'Очередь',
      dataIndex: 'queue_name',
      key: 'queue',
      width: 120,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Менеджер',
      dataIndex: 'manager_name',
      key: 'manager',
      width: 140,
      render: (v: string | null) => v || '—',
    },
  ];

  const orgColumns = [
    { title: 'Организация', dataIndex: 'organization_name', key: 'name' },
    { title: 'Регион', dataIndex: 'organization_region', key: 'region', render: (v: string | null) => v || '—' },
    { title: 'Тип', dataIndex: 'organization_type', key: 'type' },
    {
      title: 'Статус', dataIndex: 'status', key: 'status',
      render: (s: string, record: CampaignOrganization) => (
        <Tag color={orgStatusColors[s]}>{record.status_display}</Tag>
      ),
    },
    { title: 'Потребность', dataIndex: 'demand_count', key: 'demand', align: 'center' as const },
    { title: 'Менеджер', dataIndex: 'manager_name', key: 'manager', render: (v: string | null) => v || '—' },
  ];

  const tabItems = [
    {
      key: 'leads',
      label: `Лиды (${leads.length})`,
      children: (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Segmented
              value={leadsView}
              onChange={(v) => setLeadsView(v as 'table' | 'board')}
              options={[
                { value: 'table', icon: <UnorderedListOutlined />, label: 'Таблица' },
                { value: 'board', icon: <AppstoreOutlined />, label: 'Доска' },
              ]}
              size="small"
            />
          </div>
          {leadsView === 'board' ? (
            <LeadBoardView campaign={campaign} />
          ) : (
            <Table
              dataSource={leads}
              columns={leadColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 20 }}
            />
          )}
        </div>
      ),
    },
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
    ...(campaign.campaign_regions.length > 0 ? [{
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
    }] : []),
    ...(campaign.organizations.length > 0 ? [{
      key: 'organizations',
      label: `Заказчики (${campaign.organizations.length})`,
      children: (
        <Table
          dataSource={campaign.organizations}
          columns={orgColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
        />
      ),
    }] : []),
    {
      key: 'managers',
      label: `Менеджеры (${uniqueManagers.length})`,
      children: (
        <div>
          <Table
            dataSource={uniqueManagers}
            columns={[
              { title: 'Менеджер', dataIndex: 'name', key: 'name' },
              {
                title: 'Лидов', key: 'leads',
                render: (_: any, record: { id: number }) =>
                  leads.filter(l => l.manager === record.id).length || '—',
              },
              {
                title: 'Программ', key: 'programs',
                render: (_: any, record: { id: number }) =>
                  campaign.campaign_programs.filter(p => p.manager === record.id).length || '—',
              },
            ]}
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
            <Space wrap>
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
              {funnelNames.map((name, i) => (
                <Tag key={i} color="blue">{name}</Tag>
              ))}
            </Space>
          </div>
        </div>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={4}>
            <Statistic title="Потребность" value={campaign.total_demand} suffix="чел." />
          </Col>
          <Col span={4}>
            <Statistic title="Лидов" value={leads.length} />
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
        <Tabs items={tabItems} defaultActiveKey="leads" />
      </Card>
    </div>
  );
}

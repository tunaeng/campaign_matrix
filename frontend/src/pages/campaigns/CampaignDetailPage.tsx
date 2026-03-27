import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Tabs, Table, Spin, Typography,
  Button, Space, Statistic, Row, Col, Select, App, Progress, Segmented, InputNumber, Tooltip,
} from 'antd';
import { ArrowLeftOutlined, AppstoreOutlined, UnorderedListOutlined, EditOutlined } from '@ant-design/icons';
import { useCampaign, useUpdateCampaign } from '../../api/hooks';
import type { CampaignDetail, CampaignOrganization, Lead, LeadPrimaryContactBrief } from '../../types';
import { daysSinceLastTouch } from '../../utils/leadTouch';
import LeadBoardView from './LeadBoardView';
import ContactPreviewModal from '../../components/ContactPreviewModal';
import DemandQuotaPreview from '../../components/DemandQuotaPreview';

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
  const [orgContactPreview, setOrgContactPreview] = useState<{
    contact: LeadPrimaryContactBrief;
    leadId: number;
    funnelName: string | null;
  } | null>(null);
  const [touchMinDays, setTouchMinDays] = useState<number | undefined>(undefined);
  const [touchMaxDays, setTouchMaxDays] = useState<number | undefined>(undefined);

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

  const leadsAfterTouchFilter = useMemo(() => {
    const list = campaign?.leads ?? [];
    if (touchMinDays === undefined && touchMaxDays === undefined) return list;
    return list.filter((l) => {
      const days = daysSinceLastTouch(l);
      const effective = days === null ? null : Math.max(0, days);
      if (touchMinDays !== undefined) {
        if (effective !== null && effective < touchMinDays) return false;
      }
      if (touchMaxDays !== undefined) {
        if (effective === null) return false;
        if (effective > touchMaxDays) return false;
      }
      return true;
    });
  }, [campaign?.leads, touchMinDays, touchMaxDays]);

  const campaignForLeadsView: CampaignDetail | undefined = useMemo(
    () => (campaign ? { ...campaign, leads: leadsAfterTouchFilter } : undefined),
    [campaign, leadsAfterTouchFilter],
  );

  const queuePeriod = useMemo(() => {
    if (!campaign?.queues?.length) return { start: null as string | null, end: null as string | null };
    const starts = campaign.queues.map(q => q.start_date).filter(Boolean) as string[];
    const ends = campaign.queues.map(q => q.end_date).filter(Boolean) as string[];
    const start = starts.length ? [...starts].sort()[0] : null;
    const end = ends.length ? [...ends].sort().reverse()[0] : null;
    return { start, end };
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
  const leadsTabLabel =
    leads.length === leadsAfterTouchFilter.length
      ? `Лиды (${leads.length})`
      : `Лиды (${leadsAfterTouchFilter.length}/${leads.length})`;
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
    {
      title: 'Основной контакт',
      key: 'primary_contact',
      width: 200,
      render: (_: unknown, record: CampaignOrganization) => {
        const p = record.primary_contact_preview;
        if (!p?.contact) {
          return <Typography.Text type="secondary">—</Typography.Text>;
        }
        const c = p.contact;
        const label =
          c.type === 'department'
            ? (c.department_name || c.full_name || '—')
            : (c.full_name || '—');
        return (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}
            onClick={() =>
              setOrgContactPreview({
                contact: c,
                leadId: p.lead_id,
                funnelName: p.funnel_name,
              })
            }
          >
            {label}
          </Button>
        );
      },
    },
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
      label: leadsTabLabel,
      children: (
        <div>
          <Space wrap align="center" style={{ marginBottom: 12 }}>
            <Tooltip title="Не менее столько дней с последнего взаимодействия. Лиды без касаний тоже учитываются.">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Касание ≥</Typography.Text>
                <InputNumber
                  min={0}
                  value={touchMinDays}
                  onChange={(v) => setTouchMinDays(v ?? undefined)}
                  placeholder="дн."
                  style={{ width: 80 }}
                />
              </span>
            </Tooltip>
            <Tooltip title="Не больше столько дней с последнего касания; только лиды с хотя бы одним взаимодействием.">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Касание ≤</Typography.Text>
                <InputNumber
                  min={0}
                  value={touchMaxDays}
                  onChange={(v) => setTouchMaxDays(v ?? undefined)}
                  placeholder="дн."
                  style={{ width: 80 }}
                />
              </span>
            </Tooltip>
            {(touchMinDays !== undefined || touchMaxDays !== undefined) && (
              <Button
                size="small"
                type="link"
                onClick={() => {
                  setTouchMinDays(undefined);
                  setTouchMaxDays(undefined);
                }}
              >
                Сбросить
              </Button>
            )}
          </Space>
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
          {leadsView === 'board' && campaignForLeadsView ? (
            <LeadBoardView campaign={campaignForLeadsView} />
          ) : leadsView === 'table' ? (
            <Table
              dataSource={leadsAfterTouchFilter}
              columns={leadColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 20 }}
            />
          ) : null}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
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
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/campaigns/${id}/edit`)}
          >
            Редактировать
          </Button>
        </div>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={4}>
            <Statistic title="Потребность (план, Σ)" value={campaign.total_demand} suffix="чел." />
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

        {campaign.demand_summary && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Потребность по лидам: план и квоты
            </Typography.Text>
            <DemandQuotaPreview breakdown={campaign.demand_summary} />
          </div>
        )}

        <Descriptions column={2} style={{ marginTop: 16 }} size="small">
          <Descriptions.Item label="Федеральный оператор">
            {campaign.federal_operator_name || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Создал">
            {campaign.created_by_name || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Создана">
            {new Date(campaign.created_at).toLocaleString('ru-RU')}
          </Descriptions.Item>
          <Descriptions.Item label="Обновлена">
            {new Date(campaign.updated_at).toLocaleString('ru-RU')}
          </Descriptions.Item>
          <Descriptions.Item label="Период (очереди)" span={2}>
            {queuePeriod.start || queuePeriod.end
              ? `${queuePeriod.start ? new Date(queuePeriod.start).toLocaleDateString('ru-RU') : '—'} — ${queuePeriod.end ? new Date(queuePeriod.end).toLocaleDateString('ru-RU') : '—'}`
              : '—'}
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

      <ContactPreviewModal
        open={!!orgContactPreview}
        onClose={() => setOrgContactPreview(null)}
        contact={orgContactPreview?.contact ?? null}
        subtitle={orgContactPreview?.funnelName ? `Воронка: ${orgContactPreview.funnelName}` : null}
        leadLink={orgContactPreview && id ? { campaignId: id, leadId: orgContactPreview.leadId } : null}
      />
    </div>
  );
}

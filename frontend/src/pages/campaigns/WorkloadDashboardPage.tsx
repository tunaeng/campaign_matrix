import { Column, Pie } from '@ant-design/charts';
import { Card, Col, Collapse, DatePicker, Empty, Row, Select, Space, Statistic, Tabs, Tag, Typography } from 'antd';
import ResponsiveTable from '../../components/responsive/ResponsiveTable';
import type { Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCampaigns, useFunnels, useUsers, useWorkloadDashboard } from '../../api/hooks';
import { workloadStatusLabel, workloadStatusPieData, workloadActivityChartData, WORKLOAD_ACTIVITY_GROUP_OPTIONS, WORKLOAD_STATUS_CHART_COLORS, WORKLOAD_STATUS_CHART_LABELS, type WorkloadActivityGroup } from '../../utils/workloadDashboardLabels';
import { normalizeTaskStatus, TASK_WORKFLOW_STATUSES } from '../../utils/taskStatusLabels';
import type {
  WorkloadDashboardManager,
  WorkloadDashboardRow,
  WorkloadDashboardSpecialist,
  WorkloadDashboardSpecialistCampaign,
  WorkloadDashboardSpecialistTemplate,
  WorkloadDashboardSpecialistTask,
  WorkloadDashboardTaskStats,
} from '../../types';

type RoleFilter = 'manager' | 'specialist';

const roleColor: Record<string, string> = {
  manager: 'blue',
  specialist: 'purple',
};

const emptyTaskStats: WorkloadDashboardTaskStats = {
  total: 0,
  backlog: 0,
  in_progress: 0,
  paused: 0,
  rejected: 0,
  done: 0,
  overdue: 0,
};

const TASK_STAT_KEYS = ['backlog', 'in_progress', 'paused', 'rejected', 'done'] as const;

function computeStatsFromTasks(tasks: WorkloadDashboardSpecialistTask[]): WorkloadDashboardTaskStats {
  const stats = { ...emptyTaskStats };
  for (const task of tasks) {
    stats.total += 1;
    const normalized = normalizeTaskStatus(task.status);
    if (TASK_STAT_KEYS.includes(normalized)) {
      stats[normalized] += 1;
    }
    if (task.is_overdue) {
      stats.overdue += 1;
    }
  }
  return stats;
}

function sumTaskStats(items: WorkloadDashboardTaskStats[]): WorkloadDashboardTaskStats {
  return items.reduce(
    (acc, item) => ({
      total: acc.total + (item.total ?? 0),
      backlog: acc.backlog + (item.backlog ?? 0),
      in_progress: acc.in_progress + (item.in_progress ?? 0),
      paused: acc.paused + (item.paused ?? 0),
      rejected: acc.rejected + (item.rejected ?? 0),
      done: acc.done + (item.done ?? 0),
      overdue: acc.overdue + (item.overdue ?? 0),
    }),
    { ...emptyTaskStats },
  );
}

function resolveCampaignStats(campaign: WorkloadDashboardSpecialistCampaign): WorkloadDashboardTaskStats {
  if (campaign.stats && campaign.stats.total > 0) {
    return campaign.stats;
  }
  if (campaign.tasks?.length) {
    return computeStatsFromTasks(campaign.tasks);
  }
  if (campaign.templates?.length) {
    const fromTemplates = campaign.templates.map((tpl) => tpl.stats).filter(Boolean) as WorkloadDashboardTaskStats[];
    if (fromTemplates.some((s) => s.total > 0)) {
      return sumTaskStats(fromTemplates);
    }
  }
  return campaign.stats ?? emptyTaskStats;
}

function specialistOverdueTotal(specialist: WorkloadDashboardSpecialist): number {
  if (typeof specialist.overdue_total === 'number' && !Number.isNaN(specialist.overdue_total)) {
    return specialist.overdue_total;
  }
  return specialist.campaigns.reduce((sum, campaign) => sum + resolveCampaignStats(campaign).overdue, 0);
}

type SpecialistCampaignStatsRow = {
  key: string;
  campaign_id: number;
  campaign_name: string;
  stats: WorkloadDashboardTaskStats;
  templates: WorkloadDashboardSpecialistTemplate[];
};

type SpecialistTemplateStatsRow = {
  key: string;
  template_name: string;
  stats: WorkloadDashboardTaskStats;
};

function buildSpecialistCampaignRows(specialist: WorkloadDashboardSpecialist): SpecialistCampaignStatsRow[] {
  return specialist.campaigns.map((campaign) => ({
    key: String(campaign.campaign_id),
    campaign_id: campaign.campaign_id,
    campaign_name: campaign.campaign_name,
    stats: resolveCampaignStats(campaign),
    templates: (campaign.templates || []).filter((tpl) => !!tpl && !!tpl.stats),
  }));
}

function taskStatsColumns() {
  const cell = (key: keyof WorkloadDashboardTaskStats) =>
    (_: unknown, row: SpecialistCampaignStatsRow) => row.stats[key] ?? 0;

  return [
    { title: 'Всего', key: 'total', width: 70, render: cell('total') },
    { title: 'Бэклог', key: 'backlog', width: 90, render: cell('backlog') },
    { title: 'В работе', key: 'in_progress', width: 90, render: cell('in_progress') },
    { title: 'Пауза', key: 'paused', width: 80, render: cell('paused') },
    { title: 'Отказ', key: 'rejected', width: 80, render: cell('rejected') },
    { title: 'Готово', key: 'done', width: 80, render: cell('done') },
    {
      title: 'Просрочено',
      key: 'overdue',
      width: 100,
      render: (_: unknown, row: SpecialistCampaignStatsRow) => {
        const v = row.stats.overdue ?? 0;
        return v > 0 ? <Typography.Text type="danger">{v}</Typography.Text> : v;
      },
    },
  ];
}

function templateTaskStatsColumns() {
  const cell = (key: keyof WorkloadDashboardTaskStats) =>
    (_: unknown, row: SpecialistTemplateStatsRow) => row.stats[key] ?? 0;

  return [
    { title: 'Всего', key: 'total', width: 70, render: cell('total') },
    { title: 'Бэклог', key: 'backlog', width: 90, render: cell('backlog') },
    { title: 'В работе', key: 'in_progress', width: 90, render: cell('in_progress') },
    { title: 'Пауза', key: 'paused', width: 80, render: cell('paused') },
    { title: 'Отказ', key: 'rejected', width: 80, render: cell('rejected') },
    { title: 'Готово', key: 'done', width: 80, render: cell('done') },
    {
      title: 'Просрочено',
      key: 'overdue',
      width: 100,
      render: (_: unknown, row: SpecialistTemplateStatsRow) => {
        const v = row.stats.overdue ?? 0;
        return v > 0 ? <Typography.Text type="danger">{v}</Typography.Text> : v;
      },
    },
  ];
}

function ManagerDetail({
  managers,
  isLoading,
  managerRows,
}: {
  managers: WorkloadDashboardManager[];
  isLoading: boolean;
  managerRows: WorkloadDashboardRow[];
}) {
  return (
    <>
      <ResponsiveTable
        size="small"
        loading={isLoading}
        rowKey={(row) => `manager-${row.user_id}`}
        dataSource={managerRows}
        columns={[
          {
            title: 'Роль',
            dataIndex: 'role',
            key: 'role',
            width: 120,
            render: () => <Tag color={roleColor.manager}>Менеджер</Tag>,
          },
          { title: 'Пользователь', dataIndex: 'user_name', key: 'user_name' },
          { title: 'Активные лиды', dataIndex: 'active_leads', key: 'active_leads', width: 120 },
          { title: 'Пункты в работе', dataIndex: 'pending_checklist', key: 'pending_checklist', width: 140 },
          {
            title: 'Просрочка этапа',
            dataIndex: 'overdue_stage',
            key: 'overdue_stage',
            width: 140,
            render: (v: number) => (v > 0 ? <Typography.Text type="danger">{v}</Typography.Text> : v),
          },
          {
            title: 'Просрочка чек-листа',
            dataIndex: 'overdue_checklist',
            key: 'overdue_checklist',
            width: 160,
            render: (v: number) => (v > 0 ? <Typography.Text type="danger">{v}</Typography.Text> : v),
          },
        ]}
        pagination={{ pageSize: 15 }}
      />

      {managers.length ? (
        <Collapse
          style={{ marginTop: 12 }}
          items={managers.map((managerItem) => ({
            key: String(managerItem.user_id),
            label: `${managerItem.user_name} — кампаний: ${managerItem.campaigns.length}`,
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                {managerItem.campaigns.map((campaignItem) => (
                  <Card key={campaignItem.campaign_id} size="small" title={campaignItem.campaign_name}>
                    <ResponsiveTable
                      size="small"
                      rowKey={(leadRow) => String(leadRow.lead_id)}
                      pagination={{ pageSize: 5 }}
                      dataSource={campaignItem.leads}
                      columns={[
                        {
                          title: 'Лид',
                          dataIndex: 'organization_name',
                          key: 'organization_name',
                          render: (name: string, leadRow) => (
                            <Link to={`/subfunnel-workspace?campaign=${campaignItem.campaign_id}`}>
                              {name || `Лид ${leadRow.lead_id}`}
                            </Link>
                          ),
                        },
                        { title: 'Стадия', dataIndex: 'stage_name', key: 'stage_name', width: 180 },
                        {
                          title: 'Дедлайн',
                          dataIndex: 'stage_deadline',
                          key: 'stage_deadline',
                          width: 140,
                          render: (v: string | null) => (v ? new Date(v).toLocaleDateString('ru-RU') : '—'),
                        },
                        {
                          title: 'Пункты',
                          dataIndex: 'pending_checklist',
                          key: 'pending_checklist',
                          width: 100,
                        },
                        {
                          title: 'Просрочка',
                          dataIndex: 'stage_overdue',
                          key: 'stage_overdue',
                          width: 120,
                          render: (v: boolean) => (v ? <Tag color="red">Просрочено</Tag> : <Tag>В срок</Tag>),
                        },
                      ]}
                    />
                  </Card>
                ))}
              </Space>
            ),
          }))}
        />
      ) : (
        <Empty style={{ marginTop: 12 }} description="Нет данных по менеджерам" />
      )}
    </>
  );
}

function SpecialistDetail({
  specialists,
  isLoading,
  specialistRows,
}: {
  specialists: WorkloadDashboardSpecialist[];
  isLoading: boolean;
  specialistRows: WorkloadDashboardRow[];
}) {
  const templateRowsForCampaign = (campaign: SpecialistCampaignStatsRow): SpecialistTemplateStatsRow[] =>
    (campaign.templates || []).map((tpl) => ({
      key: `${campaign.key}-tpl-${tpl.template_id}`,
      template_name: tpl.template_name || `Шаблон #${tpl.template_id}`,
      stats: tpl.stats,
    }));

  return (
    <>
      <ResponsiveTable
        size="small"
        loading={isLoading}
        rowKey={(row) => `specialist-${row.user_id}`}
        dataSource={specialistRows}
        columns={[
          {
            title: 'Роль',
            dataIndex: 'role',
            key: 'role',
            width: 120,
            render: () => <Tag color={roleColor.specialist}>Специалист</Tag>,
          },
          { title: 'Пользователь', dataIndex: 'user_name', key: 'user_name' },
          { title: 'Задачи в работе', dataIndex: 'tasks_in_progress', key: 'tasks_in_progress', width: 150 },
          {
            title: 'Просроченные задачи',
            dataIndex: 'tasks_overdue',
            key: 'tasks_overdue',
            width: 170,
            render: (v: number) => (v > 0 ? <Typography.Text type="danger">{v}</Typography.Text> : v),
          },
          { title: 'Активные лиды', dataIndex: 'active_leads', key: 'active_leads', width: 120 },
          { title: 'Пункты в работе', dataIndex: 'pending_checklist', key: 'pending_checklist', width: 140 },
        ]}
        pagination={{ pageSize: 15 }}
      />

      {specialists.length ? (
        <Collapse
          style={{ marginTop: 12 }}
          items={specialists.map((specialistItem) => {
            const campaignRows = buildSpecialistCampaignRows(specialistItem);
            const overdueTotal = specialistOverdueTotal(specialistItem);
            return {
              key: String(specialistItem.user_id),
              label: `${specialistItem.user_name} — просрочено: ${overdueTotal}`,
              children: (
                <ResponsiveTable<SpecialistCampaignStatsRow>
                  size="small"
                  pagination={campaignRows.length > 10 ? { pageSize: 10 } : false}
                  rowKey="key"
                  dataSource={campaignRows}
                  expandable={{
                    rowExpandable: (row) => (row.templates?.length || 0) > 0,
                    expandedRowRender: (row) => (
                      <ResponsiveTable
                        size="small"
                        pagination={false}
                        rowKey="key"
                        dataSource={templateRowsForCampaign(row)}
                        columns={[
                          {
                            title: 'Шаблон задач',
                            dataIndex: 'template_name',
                            key: 'template_name',
                            width: 280,
                          },
                          ...templateTaskStatsColumns(),
                        ]}
                      />
                    ),
                  }}
                  columns={[
                    {
                      title: 'Кампания',
                      dataIndex: 'campaign_name',
                      key: 'campaign_name',
                      render: (name: string, row) => (
                        <Space size="small" wrap>
                          <span>{name}</span>
                          <Link
                            to={`/subfunnel-workspace?campaign=${row.campaign_id}&assignee=${specialistItem.user_id}`}
                          >
                            Задачи
                          </Link>
                        </Space>
                      ),
                    },
                    ...taskStatsColumns(),
                  ]}
                />
              ),
            };
          })}
        />
      ) : (
        <Empty style={{ marginTop: 12 }} description="Нет данных по специалистам" />
      )}
    </>
  );
}

export default function WorkloadDashboardPage() {
  const [role, setRole] = useState<RoleFilter>('manager');
  const [campaign, setCampaign] = useState<number | undefined>(undefined);
  const [funnel, setFunnel] = useState<number | undefined>(undefined);
  const [user, setUser] = useState<number | undefined>(undefined);
  const [period, setPeriod] = useState<[Dayjs, Dayjs] | null>(null);
  const [activityGroup, setActivityGroup] = useState<WorkloadActivityGroup>('day');

  const { data: campaignsData } = useCampaigns({ page_size: 200 });
  const { data: funnelsData } = useFunnels({ page_size: 200 });
  const { data: usersData } = useUsers();

  const { data: dashboard, isLoading } = useWorkloadDashboard({
    role,
    campaign,
    funnel,
    user,
    ...(period
      ? {
          date_from: period[0].format('YYYY-MM-DD'),
          date_to: period[1].format('YYYY-MM-DD'),
        }
      : {}),
  });

  const campaignOptions = (campaignsData?.results || []).map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const funnelOptions = (funnelsData?.results || []).map((f) => ({
    value: f.id,
    label: f.name,
  }));
  const userOptions = (usersData?.results || []).map((u) => ({
    value: u.id,
    label: u.full_name || u.username,
  }));

  const rows = dashboard?.rows || [];
  const totals = dashboard?.totals || {
    active_leads: 0,
    pending_checklist: 0,
    overdue_stage: 0,
    overdue_checklist: 0,
    tasks_in_progress: 0,
    tasks_overdue: 0,
  };
  const managerRows = useMemo(() => rows.filter((r) => r.role === 'manager'), [rows]);
  const specialistRows = useMemo(() => rows.filter((r) => r.role === 'specialist'), [rows]);
  const managers = dashboard?.managers || [];
  const specialists = dashboard?.specialists || [];
  const charts = dashboard?.charts;

  const columnChartData = useMemo(
    () => (charts?.by_campaign || []).flatMap((x) => [
      { campaign_name: x.campaign_name, metric: 'Открыто', value: x.in_progress || 0 },
      { campaign_name: x.campaign_name, metric: 'Просрочено', value: x.overdue || 0 },
    ]),
    [charts?.by_campaign],
  );

  const activityChartData = useMemo(
    () => workloadActivityChartData(charts?.by_day, activityGroup),
    [charts?.by_day, activityGroup],
  );

  const pieChartData = useMemo(
    () => workloadStatusPieData(charts?.status_pie),
    [charts?.status_pie],
  );

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 12 }}>
        Дашборд загрузки
      </Typography.Title>

      <Tabs
        activeKey={role}
        onChange={(v) => setRole(v as RoleFilter)}
        style={{ marginBottom: 16 }}
        items={[
          { key: 'manager', label: 'Менеджеры' },
          { key: 'specialist', label: 'Специалисты' },
        ]}
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space className="filter-bar" wrap>
          <DatePicker.RangePicker
            allowClear
            value={period}
            format="DD.MM.YY"
            placeholder={['Начало', 'Конец']}
            onChange={(v) => {
              setPeriod(v?.[0] && v?.[1] ? [v[0], v[1]] : null);
            }}
          />
          <Select
            allowClear
            value={campaign}
            style={{ width: 260 }}
            placeholder="Кампания"
            options={campaignOptions}
            onChange={(v) => setCampaign(v)}
          />
          <Select
            allowClear
            value={funnel}
            style={{ width: 240 }}
            placeholder="Воронка"
            options={funnelOptions}
            onChange={(v) => setFunnel(v)}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            value={user}
            style={{ width: 260 }}
            placeholder="Пользователь"
            options={userOptions}
            onChange={(v) => setUser(v)}
          />
        </Space>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          {period
            ? 'Период: активность (обновление, старт, завершение, открытые на конец периода).'
            : 'Период не выбран — данные за всё время.'}
        </Typography.Text>
      </Card>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={12} sm={8} xl={4}>
          <Card size="small">
            <Statistic title="Активные лиды" value={totals.active_leads} />
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <Card size="small">
            <Statistic title="Невыполненные пункты" value={totals.pending_checklist} />
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <Card size="small">
            <Statistic title="Открытые задачи" value={totals.tasks_in_progress} />
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <Card size="small">
            <Statistic title="Просроченные этапы" value={totals.overdue_stage} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <Card size="small">
            <Statistic title="Просроченный чек-лист" value={totals.overdue_checklist} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <Card size="small">
            <Statistic title="Просроченные задачи" value={totals.tasks_overdue} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={24} lg={12}>
          <Card size="small" title="По кампаниям">
            <Column
              data={columnChartData}
              xField="campaign_name"
              yField="value"
              seriesField="metric"
              isGroup
              height={260}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Статусы">
            <Pie
              data={pieChartData}
              angleField="count"
              colorField="status_label"
              label={{ text: (d: { status_label: string; count: number }) => `${d.status_label}: ${d.count}` }}
              legend={{
                color: {
                  title: false,
                  itemLabelText: (datum: { label: string }) => datum.label,
                },
              }}
              tooltip={{
                title: (datum: { status_label?: string; status?: string }) =>
                  datum.status_label || workloadStatusLabel(datum.status || ''),
                items: [{ channel: 'y', name: 'Количество', valueFormatter: (v: number) => String(v) }],
              }}
              height={260}
            />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title="Активность по периодам"
        extra={(
          <Select
            value={activityGroup}
            style={{ width: 140 }}
            options={WORKLOAD_ACTIVITY_GROUP_OPTIONS}
            onChange={(v) => setActivityGroup(v)}
          />
        )}
        style={{ marginBottom: 12 }}
      >
        <Column
          data={activityChartData}
          xField="period"
          yField="value"
          seriesField="status_label"
          isGroup
          height={260}
          scale={{
            color: {
              domain: WORKLOAD_STATUS_CHART_LABELS,
              range: TASK_WORKFLOW_STATUSES.map((status) => WORKLOAD_STATUS_CHART_COLORS[status]),
            },
          }}
          axis={{
            x: {
              labelFormatter: (value: string) => value,
            },
          }}
          legend={{
            color: {
              title: false,
              itemLabelText: (datum: { label: string }) => datum.label,
            },
          }}
          tooltip={{
            title: (datum: { period?: string }) => datum.period || '',
            items: [{ channel: 'y', name: 'Задач', valueFormatter: (v: number) => String(v) }],
          }}
        />
      </Card>

      <Card size="small">
        {role === 'manager' ? (
          <ManagerDetail managers={managers} isLoading={isLoading} managerRows={managerRows} />
        ) : (
          <SpecialistDetail specialists={specialists} isLoading={isLoading} specialistRows={specialistRows} />
        )}
      </Card>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Tabs, Table, Spin, Typography,
  Button, Space, Statistic, Row, Col, Select, App, Progress, Segmented, InputNumber, Tooltip, Modal, Upload, Form,
} from 'antd';
import { ArrowLeftOutlined, AppstoreOutlined, UnorderedListOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useCampaign, useUpdateCampaign, useDeleteCampaign, useOrganizationTags, useFunnel, useBulkUpdateLeads, useBulkDeleteLeads } from '../../api/hooks';
import type { CampaignDetail, CampaignOrganization, Lead, LeadPrimaryContactBrief, OrganizationTag } from '../../types';
import { daysSinceLastTouch } from '../../utils/leadTouch';
import client from '../../api/client';
import { getAxiosErrorMessage } from '../../api/errorMessage';
import LeadBoardView from './LeadBoardView';
import ContactPreviewModal from '../../components/ContactPreviewModal';
import DemandQuotaPreview from '../../components/DemandQuotaPreview';
import EntityTagSelect, { renderTagChips } from '../../components/EntityTagSelect';
import BulkSelectionToolbar from '../../components/BulkSelectionToolbar';
import type { UploadFile } from 'antd/es/upload/interface';

const statusColors: Record<string, string> = {
  draft: 'default',
  active: 'processing',
  paused: 'warning',
  completed: 'success',
};

type CampaignStageValue = CampaignDetail['status'] | 'organization_list';

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
  const { data: campaign, isLoading, refetch: refetchCampaign } = useCampaign(id!);
  const updateCampaign = useUpdateCampaign(id!);
  const deleteCampaign = useDeleteCampaign();
  const { data: leadTagsCatalog } = useOrganizationTags({ page_size: 500, tag_type: 'leads' });
  const { data: organizationTagsCatalog } = useOrganizationTags({ page_size: 500, tag_type: 'organizations' });
  const [leadsView, setLeadsView] = useState<'table' | 'board'>('board');
  const [leadOrgTagFilter, setLeadOrgTagFilter] = useState<number[]>([]);
  const [orgContactPreview, setOrgContactPreview] = useState<{
    contact: LeadPrimaryContactBrief;
    leadId: number;
    funnelName: string | null;
  } | null>(null);
  const [touchMinDays, setTouchMinDays] = useState<number | undefined>(undefined);
  const [touchMaxDays, setTouchMaxDays] = useState<number | undefined>(undefined);
  const [leadDemandImportOpen, setLeadDemandImportOpen] = useState(false);
  const [leadDemandImportFiles, setLeadDemandImportFiles] = useState<UploadFile[]>([]);
  const [leadDemandImportBusy, setLeadDemandImportBusy] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [bulkStageModalOpen, setBulkStageModalOpen] = useState(false);
  const [bulkStageForm] = Form.useForm();
  const bulkUpdateLeads = useBulkUpdateLeads();
  const bulkDeleteLeads = useBulkDeleteLeads();
  const funnelId = campaign?.campaign_funnels?.[0]?.funnel;
  const { data: funnelDetail } = useFunnel(funnelId ?? 0);
  const showCollectStage = campaign?.operational_stage === 'organization_list';

  const leadStageOptions = useMemo(
    () => [...(funnelDetail?.stages || [])]
      .filter((s) => showCollectStage || !s.is_collect_stage)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ value: s.id, label: s.name })),
    [funnelDetail, showCollectStage],
  );

  const leadBulkBusy = bulkUpdateLeads.isPending || bulkDeleteLeads.isPending;

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

  const campaignTagIdsPresent = useMemo(() => {
    const s = new Set<number>();
    if (!campaign) return s;
    for (const l of campaign.leads ?? []) {
      for (const tid of l.tags ?? []) s.add(tid);
      for (const tid of l.organization_tags ?? []) s.add(tid);
    }
    for (const o of campaign.organizations ?? []) {
      for (const tid of o.organization_tags ?? []) s.add(tid);
    }
    return s;
  }, [campaign]);

  /** Регионы из явных строк кампании, с лидов (region / подпись) и с заказчиков */
  const distinctCampaignRegionsCount = useMemo(() => {
    if (!campaign) return 0;
    const keys = new Set<string>();
    const addByName = (name: string | null | undefined) => {
      const n = (name || '').trim().toLowerCase();
      if (n) keys.add(`n:${n}`);
    };
    for (const r of campaign.campaign_regions ?? []) {
      if (r.region != null) keys.add(`id:${r.region}`);
      else addByName(r.region_name);
    }
    for (const l of campaign.leads ?? []) {
      if (l.region != null) keys.add(`id:${l.region}`);
      else addByName(l.organization_region);
    }
    for (const o of campaign.organizations ?? []) {
      addByName(o.organization_region);
    }
    return keys.size;
  }, [campaign]);

  const leadOrgTagCatalogMerged = useMemo((): OrganizationTag[] => {
    const byId = new Map<number, OrganizationTag>();
    for (const t of leadTagsCatalog?.results ?? []) byId.set(t.id, t);
    for (const t of organizationTagsCatalog?.results ?? []) byId.set(t.id, t);
    const merged = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    if (!campaign) return merged;
    const keep = new Set(campaignTagIdsPresent);
    for (const id of leadOrgTagFilter) keep.add(id);
    return merged.filter((t) => keep.has(t.id));
  }, [
    leadTagsCatalog?.results,
    organizationTagsCatalog?.results,
    campaign,
    campaignTagIdsPresent,
    leadOrgTagFilter,
  ]);

  const leadsAfterFilters = useMemo(() => {
    if (!leadOrgTagFilter.length) return leadsAfterTouchFilter;
    return leadsAfterTouchFilter.filter((l) => {
      const onLead = l.tags || [];
      const onOrg = l.organization_tags || [];
      return leadOrgTagFilter.some(
        (tid) => onLead.includes(tid) || onOrg.includes(tid),
      );
    });
  }, [leadsAfterTouchFilter, leadOrgTagFilter]);

  const campaignForLeadsView: CampaignDetail | undefined = useMemo(
    () => (campaign ? { ...campaign, leads: leadsAfterFilters } : undefined),
    [campaign, leadsAfterFilters],
  );

  const queuePeriod = useMemo(() => {
    if (!campaign?.queues?.length) return { start: null as string | null, end: null as string | null };
    const starts = campaign.queues.map(q => q.start_date).filter(Boolean) as string[];
    const ends = campaign.queues.map(q => q.end_date).filter(Boolean) as string[];
    const start = starts.length ? [...starts].sort()[0] : null;
    const end = ends.length ? [...ends].sort().reverse()[0] : null;
    return { start, end };
  }, [campaign]);

  async function runLeadBulkMoveStage() {
    if (!selectedLeadIds.length) return;
    try {
      const vals = await bulkStageForm.validateFields();
      const result = await bulkUpdateLeads.mutateAsync({
        ids: selectedLeadIds,
        current_stage: vals.current_stage ?? null,
      });
      const skipped = result.skipped?.length || 0;
      if (skipped > 0) {
        message.warning(`Обновлено: ${result.updated}. Пропущено: ${skipped}.`);
      } else {
        message.success(`Обновлено лидов: ${result.updated ?? 0}`);
      }
      setBulkStageModalOpen(false);
      bulkStageForm.resetFields();
      setSelectedLeadIds([]);
    } catch {
      message.error('Не удалось перенести лидов');
    }
  }

  async function runLeadBulkDelete() {
    if (!selectedLeadIds.length) return;
    try {
      const result = await bulkDeleteLeads.mutateAsync(selectedLeadIds);
      message.success(`Удалено лидов: ${result.deleted ?? 0}`);
      setSelectedLeadIds([]);
    } catch {
      message.error('Не удалось удалить лидов');
    }
  }

  if (isLoading) return <div style={{ textAlign: 'center', paddingTop: 100 }}><Spin size="large" /></div>;
  if (!campaign) return <Typography.Text>Кампания не найдена</Typography.Text>;

  const handleStatusChange = async (newStage: CampaignStageValue) => {
    try {
      await updateCampaign.mutateAsync({ board_column: newStage });
      message.success('Статус обновлён');
    } catch {
      message.error('Ошибка обновления статуса');
    }
  };

  const handleDeleteCampaign = () => {
    Modal.confirm({
      title: 'Удалить кампанию?',
      content:
        'Кампания и связанные с ней лиды, очереди и настройки будут удалены без возможности восстановления.',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await deleteCampaign.mutateAsync(Number(id));
          message.success('Кампания удалена');
          navigate('/campaigns');
        } catch {
          message.error('Не удалось удалить кампанию');
        }
      },
    });
  };

  const downloadLeadDemandTemplate = async () => {
    try {
      const res = await client.get(`/campaigns/${id}/leads-demand-import-template/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaign_${id}_leads_demand_template.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('Шаблон скачан');
    } catch (err) {
      message.error(`Не удалось скачать шаблон: ${getAxiosErrorMessage(err)}`);
    }
  };

  const submitLeadDemandImport = async () => {
    const file = leadDemandImportFiles[0]?.originFileObj;
    if (!file) {
      message.error('Выберите .xlsx файл для импорта');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    setLeadDemandImportBusy(true);
    try {
      const res = await client.post(`/campaigns/${id}/leads-demand-import/`, fd);
      const data = res.data || {};
      message.success(`Импорт завершён: обновлено ${data.updated ?? 0}, пропущено ${data.skipped ?? 0}`);
      if (Array.isArray(data.errors) && data.errors.length) {
        Modal.info({
          title: 'Импорт завершён с замечаниями',
          width: 860,
          content: (
            <div style={{ maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {data.errors.slice(0, 40).join('\n')}
            </div>
          ),
        });
      }
      setLeadDemandImportOpen(false);
      setLeadDemandImportFiles([]);
      await refetchCampaign();
    } catch (err) {
      message.error(`Не удалось импортировать файл: ${getAxiosErrorMessage(err)}`);
    } finally {
      setLeadDemandImportBusy(false);
    }
  };

  const leads = campaign.leads || [];
  const visibleLeadCount = leadsAfterFilters.length;
  const leadsTabLabel =
    visibleLeadCount === leads.length
      ? `Лиды (${leads.length})`
      : `Лиды (${visibleLeadCount}/${leads.length})`;
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
        <div>
          <a onClick={() => navigate(`/campaigns/${id}/leads/${record.id}`)}>{text}</a>
          {record.forwarded_from && (
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Передано от: {record.forwarded_from}
            </Typography.Text>
          )}
        </div>
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
      title: 'Теги',
      key: 'lead_tags',
      width: 200,
      render: (_: unknown, record: Lead) => renderTagChips(record.tag_names, leadTagsCatalog?.results, record.tags) || '—',
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
    { title: 'Списочная (факт)', dataIndex: 'demand_count', key: 'demand', align: 'center' as const },
    { title: 'Менеджер', dataIndex: 'manager_name', key: 'manager', render: (v: string | null) => v || '—' },
  ];

  const tabItems = [
    {
      key: 'leads',
      label: leadsTabLabel,
      children: (
        <div>
          <Space style={{ marginBottom: 12 }} wrap>
            <Button onClick={downloadLeadDemandTemplate}>
              Скачать шаблон импорта потребности
            </Button>
            <Button onClick={() => setLeadDemandImportOpen(true)}>
              Импорт потребности по лидам
            </Button>
          </Space>
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
            <Tooltip title="Лид попадает в список, если у него или у его организации есть хотя бы один из выбранных тегов">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Теги</Typography.Text>
                <EntityTagSelect
                  availableTags={leadOrgTagCatalogMerged}
                  value={leadOrgTagFilter}
                  onChange={(v) => setLeadOrgTagFilter(v)}
                  placeholder="Фильтр"
                  style={{ minWidth: 220 }}
                  allowClear
                />
              </span>
            </Tooltip>
            {(touchMinDays !== undefined || touchMaxDays !== undefined || leadOrgTagFilter.length > 0) && (
              <Button
                size="small"
                type="link"
                onClick={() => {
                  setTouchMinDays(undefined);
                  setTouchMaxDays(undefined);
                  setLeadOrgTagFilter([]);
                }}
              >
                Сбросить фильтры
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
            <>
              {selectedLeadIds.length > 0 && (
                <BulkSelectionToolbar
                  count={selectedLeadIds.length}
                  entityLabel="лидов"
                  busy={leadBulkBusy}
                  onMoveStage={() => setBulkStageModalOpen(true)}
                  moveStageLabel="Стадия…"
                  onDelete={runLeadBulkDelete}
                  deleteConfirmTitle={`Удалить ${selectedLeadIds.length} лидов?`}
                  onClearSelection={() => setSelectedLeadIds([])}
                />
              )}
              <Table
                dataSource={leadsAfterFilters}
                columns={leadColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 20 }}
                rowSelection={{
                  selectedRowKeys: selectedLeadIds,
                  onChange: (keys) => {
                    if (leadBulkBusy) return;
                    setSelectedLeadIds(keys as number[]);
                  },
                  getCheckboxProps: () => ({ disabled: leadBulkBusy }),
                  selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
                }}
              />
            </>
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
              {campaign.operational_stage_display && (
                <Tag color="blue">{campaign.operational_stage_display}</Tag>
              )}
              <Select
                value={(campaign.operational_stage || campaign.status) as CampaignStageValue}
                onChange={handleStatusChange}
                size="small"
                style={{ width: 160 }}
                options={[
                  { value: 'draft', label: 'Черновик' },
                  { value: 'organization_list', label: 'Формирование перечня' },
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
          <Space>
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={deleteCampaign.isPending}
              onClick={handleDeleteCampaign}
            >
              Удалить
            </Button>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/campaigns/${id}/edit`)}
            >
              Редактировать
            </Button>
          </Space>
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
            <Statistic title="Регионов" value={distinctCampaignRegionsCount} />
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
            {campaign.federal_operator_short_name?.trim()
              || campaign.federal_operator_name
              || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Проект">
            {campaign.project_name || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Наша организация">
            {campaign.acting_organization_name || '—'}
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

      <Modal
        title="Импорт потребности по лидам"
        open={leadDemandImportOpen}
        onCancel={() => {
          if (leadDemandImportBusy) return;
          setLeadDemandImportOpen(false);
          setLeadDemandImportFiles([]);
        }}
        onOk={submitLeadDemandImport}
        okText="Импортировать"
        confirmLoading={leadDemandImportBusy}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Upload
            maxCount={1}
            accept=".xlsx"
            fileList={leadDemandImportFiles}
            beforeUpload={(file) => {
              setLeadDemandImportFiles([
                {
                  uid: `${Date.now()}-${file.name}`,
                  name: file.name,
                  status: 'done',
                  originFileObj: file,
                },
              ]);
              return false;
            }}
            onRemove={() => setLeadDemandImportFiles([])}
          >
            <Button>Выбрать файл</Button>
          </Upload>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Используйте шаблон из этой кампании: он содержит список лидов, текущие значения, этап и отдельные колонки
            по всем пунктам чек-листа (информативно). Для импорта обновляются: План, Заявленная и Списочная (факт).
          </Typography.Text>
        </Space>
      </Modal>

      <Modal
        title="Перенести лидов на стадию"
        open={bulkStageModalOpen}
        onCancel={() => { setBulkStageModalOpen(false); bulkStageForm.resetFields(); }}
        onOk={runLeadBulkMoveStage}
        confirmLoading={bulkUpdateLeads.isPending}
        destroyOnClose
      >
        <Form form={bulkStageForm} layout="vertical">
          <Form.Item name="current_stage" label="Стадия">
            <Select allowClear options={leadStageOptions} placeholder="Без стадии" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

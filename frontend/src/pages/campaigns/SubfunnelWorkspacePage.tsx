import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  SearchOutlined,
  TeamOutlined,
  AppstoreOutlined,
  FieldTimeOutlined,
  ExportOutlined,
  UnorderedListOutlined,
  UserOutlined,
  CheckOutlined,
  CalendarOutlined,
  NodeIndexOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import TaskEditDrawer from '../../components/TaskEditDrawer';
import KanbanColumnHeader from '../../components/KanbanColumnHeader';
import {
  useBulkUpdateLeadSubfunnels,
  useBulkUpdateLeadSubfunnelChecklist,
  useBulkDeleteLeadSubfunnels,
  useCampaigns,
  usePatchLeadSubfunnel,
  useSetLeadSubfunnelStage,
  useRoles,
  useSubfunnelTemplateItems,
  useSubfunnelWorkspace,
  useTaskTemplateStages,
  useUsers,
} from '../../api/hooks';
import { getAxiosErrorMessage } from '../../api/errorMessage';
import type { SubfunnelWorkspaceItem } from '../../types';
import { normalizeTaskStatus, TASK_STATUS_META, TASK_WORKFLOW_STATUSES, type TaskWorkflowStatus } from '../../utils/taskStatusLabels';
import './BoardStyles.css';

type TaskDragPayload = { type: 'task'; taskId: number; stageKey: string };
type ViewMode = 'kanban' | 'list';
type BulkModalKind = 'assignee' | 'due' | 'status' | 'stage' | 'checklist' | null;

function TaskCardFace({ item }: { item: SubfunnelWorkspaceItem }) {
  const workflowStatus = normalizeTaskStatus(item.status);
  const status = TASK_STATUS_META[workflowStatus] || { label: item.status, color: 'default' };
  const checklist = item.checklist_progress;
  const checklistItems = item.checklist_summary || [];
  const checklistPct = checklist && checklist.total > 0
    ? Math.round((checklist.completed / checklist.total) * 100)
    : null;

  return (
    <div className={`kanban-task-card-body kanban-task-card-body--${workflowStatus}`}>
      <div className="kanban-task-card-head">
        <div className="kanban-task-card-head-main">
          {item.is_region_task && (
            <div className="kanban-task-card-tag-row">
              <Tag color="cyan" className="kanban-task-card-region-tag">Регион</Tag>
            </div>
          )}
          <div className="kanban-task-card-template">
            <span className="kanban-task-card-subject-name">{item.lead_name}</span>
          </div>
        </div>
        <div className="kanban-task-card-badges">
          <Tag color={status.color} className="kanban-task-card-status-tag">{status.label}</Tag>
          {item.is_overdue && <Tag color="red">Просрочено</Tag>}
          {!item.is_available && <Tag>Недоступна</Tag>}
        </div>
      </div>

      {item.forwarded_from && (
        <div className="kanban-task-card-forward-row">
          <Tag color="gold" className="kanban-task-card-forward-tag" title={item.forwarded_from}>
            От: {item.forwarded_from}
          </Tag>
        </div>
      )}

      <div className="kanban-task-card-meta">
        <span className="kanban-task-card-meta-item" title="Кампания">
          <AppstoreOutlined />
          <span>{item.campaign_name}</span>
        </span>
        {item.role_name && (
          <span className="kanban-task-card-meta-item" title="Роль">
            <TeamOutlined />
            <span>{item.role_name}</span>
          </span>
        )}
        <span className="kanban-task-card-meta-item" title="Исполнитель">
          <UserOutlined />
          <span>{item.assignee_name || 'Не назначен'}</span>
        </span>
        {item.show_capture_counts && item.capture_counts && (
          <span className="kanban-task-card-meta-item" title="Добавлено в задаче">
            <span>
              Орг: {item.capture_counts.organizations} · Конт: {item.capture_counts.contacts}
            </span>
          </span>
        )}
      </div>

      <div className="kanban-task-card-footer">
        {item.current_template_stage_name && (
          <Tag className="kanban-task-card-stage-tag">{item.current_template_stage_name}</Tag>
        )}
        {item.stage_name && (
          <span className="kanban-task-card-context">
            {item.is_region_task ? `Стадия: ${item.stage_name}` : item.stage_name}
          </span>
        )}
        {item.due_at && (
          <span className={`kanban-task-card-due${item.is_overdue ? ' kanban-task-card-due--overdue' : ''}`}>
            <FieldTimeOutlined />
            {new Date(item.due_at).toLocaleDateString('ru-RU')}
          </span>
        )}
      </div>

      {checklistPct !== null && (
        <div className="kanban-task-card-checklist">
          <Progress
            percent={checklistPct}
            size="small"
            showInfo={false}
            strokeColor={checklistPct === 100 ? '#52c41a' : undefined}
          />
          <span className="kanban-task-card-checklist-label">
            {checklist!.completed}/{checklist!.total}
          </span>
        </div>
      )}
      {checklistItems.length > 0 && (
        <div className="kanban-card-checklist kanban-task-card-checklist-items">
          {checklistItems.map((checklistItem, idx) => (
            <div key={idx} className={`kanban-checklist-item${checklistItem.done ? ' done' : ''}`}>
              <CheckOutlined style={{ fontSize: 10, color: checklistItem.done ? '#52c41a' : '#d9d9d9' }} />
              <span>{checklistItem.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanDropColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`kanban-cards${isOver ? ' kanban-droppable-over' : ''}`}>
      {children}
    </div>
  );
}

function TaskBoardCard({
  item,
  selected,
  onToggleSelect,
  onOpen,
  onOpenLead,
  dragDisabled,
  selectDisabled,
}: {
  item: SubfunnelWorkspaceItem;
  selected: boolean;
  onToggleSelect: (id: number, checked: boolean) => void;
  onOpen: (item: SubfunnelWorkspaceItem) => void;
  onOpenLead: (item: SubfunnelWorkspaceItem) => void;
  dragDisabled: boolean;
  selectDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task-${item.id}`,
    disabled: dragDisabled,
    data: {
      type: 'task',
      taskId: item.id,
      stageKey: item.board_stage_key || `stage-${item.current_template_stage_id ?? 'unassigned'}`,
    } satisfies TaskDragPayload,
  });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'kanban-card--source-dragging' : undefined}
      {...listeners}
      {...attributes}
    >
      <div
        className={`kanban-card kanban-card--task${selected ? ' kanban-card--selected' : ''}`}
        onClick={() => onOpen(item)}
      >
        <div className="kanban-task-card-toolbar">
          <Checkbox
            className="kanban-card-select"
            checked={selected}
            disabled={selectDisabled}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggleSelect(item.id, e.target.checked)}
          />
          {!item.is_region_task && item.lead_id && (
            <Tooltip title="Открыть лид">
              <Button
                type="text"
                size="small"
                icon={<ExportOutlined />}
                className="kanban-card-lead-link"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLead(item);
                }}
              />
            </Tooltip>
          )}
        </div>
        <TaskCardFace item={item} />
      </div>
    </div>
  );
}

interface TaskBulkToolbarProps {
  count: number;
  busy: boolean;
  onAssignee: () => void;
  onDue: () => void;
  onStatus: () => void;
  onStage: () => void;
  onChecklist: () => void;
  onClearAssignee: () => void;
  onClearDue: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

function TaskBulkToolbar({
  count,
  busy,
  onAssignee,
  onDue,
  onStatus,
  onStage,
  onChecklist,
  onClearAssignee,
  onClearDue,
  onDelete,
  onClearSelection,
}: TaskBulkToolbarProps) {
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message={
        <Space wrap align="center">
          {busy && <Spin size="small" />}
          <Typography.Text strong>Выбрано задач: {count}</Typography.Text>
        </Space>
      }
      action={
        <Space wrap>
          <Button size="small" icon={<UserOutlined />} disabled={busy} onClick={onAssignee}>
            Исполнитель…
          </Button>
          <Button size="small" icon={<CalendarOutlined />} disabled={busy} onClick={onDue}>
            Срок…
          </Button>
          <Button size="small" icon={<NodeIndexOutlined />} disabled={busy} onClick={onStatus}>
            Статус…
          </Button>
          <Button size="small" icon={<NodeIndexOutlined />} disabled={busy} onClick={onStage}>
            Этап…
          </Button>
          <Button size="small" icon={<CheckOutlined />} disabled={busy} onClick={onChecklist}>
            Чек-лист…
          </Button>
          <Button size="small" disabled={busy} onClick={onClearAssignee}>
            Снять исполнителя
          </Button>
          <Button size="small" disabled={busy} onClick={onClearDue}>
            Снять срок
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} disabled={busy} onClick={onDelete}>
            Удалить
          </Button>
          <Button size="small" type="link" disabled={busy} onClick={onClearSelection}>
            Снять выбор
          </Button>
        </Space>
      }
    />
  );
}

export default function SubfunnelWorkspacePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const patchTask = usePatchLeadSubfunnel();
  const setTaskStage = useSetLeadSubfunnelStage();
  const bulkUpdate = useBulkUpdateLeadSubfunnels();
  const bulkChecklist = useBulkUpdateLeadSubfunnelChecklist();
  const bulkDelete = useBulkDeleteLeadSubfunnels();

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [campaign, setCampaign] = useState<number | undefined>();
  const [role, setRole] = useState<number | undefined>();
  const [assignee, setAssignee] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [overdue, setOverdue] = useState<boolean | undefined>();
  const [search, setSearch] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<number | undefined>();
  const [activeDragItem, setActiveDragItem] = useState<SubfunnelWorkspaceItem | null>(null);
  const [editingTask, setEditingTask] = useState<SubfunnelWorkspaceItem | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [bulkModal, setBulkModal] = useState<BulkModalKind>(null);
  const [bulkForm] = Form.useForm();

  const { data: campaignsData } = useCampaigns({ page_size: 200 });
  const { data: rolesData } = useRoles({ page_size: 200 });
  const { data: usersData } = useUsers();
  const { data: templateItems = [] } = useSubfunnelTemplateItems(activeTemplate);
  const { data: templateStages = [] } = useTaskTemplateStages(activeTemplate);
  const { data, isLoading, isError, error, refetch } = useSubfunnelWorkspace({
    view_mode: viewMode === 'kanban' ? 'kanban' : 'table',
    campaign,
    template: activeTemplate,
    role,
    assignee,
    status: statusFilter,
    overdue,
  });

  useEffect(() => {
    const campaignParam = searchParams.get('campaign');
    const assigneeParam = searchParams.get('assignee');
    const templateParam = searchParams.get('template');
    const parsedCampaign = campaignParam && /^\d+$/.test(campaignParam) ? Number(campaignParam) : undefined;
    const parsedAssignee = assigneeParam && /^\d+$/.test(assigneeParam) ? Number(assigneeParam) : undefined;
    const parsedTemplate = templateParam && /^\d+$/.test(templateParam) ? Number(templateParam) : undefined;
    if (parsedCampaign !== undefined) setCampaign(parsedCampaign);
    if (parsedAssignee !== undefined) setAssignee(parsedAssignee);
    if (parsedTemplate !== undefined) setActiveTemplate(parsedTemplate);
  }, [searchParams]);

  useEffect(() => {
    if (!data?.templates?.length) return;
    if (activeTemplate && data.templates.some((t) => t.id === activeTemplate)) return;
    const fromApi = data.active_template_id || data.templates[0].id;
    setActiveTemplate(fromApi);
  }, [data, activeTemplate]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [activeTemplate, campaign, role, assignee, statusFilter, overdue]);

  const campaignOptions = (campaignsData?.results || []).map((c) => ({ value: c.id, label: c.name }));
  const roleOptions = (rolesData?.results || []).map((r) => ({ value: r.id, label: r.name }));
  const userOptions = (usersData?.results || []).map((u) => ({ value: u.id, label: u.full_name || u.username }));
  const stageFilterOptions = (data?.columns || []).map((col) => ({
    value: col.status,
    label: col.stage_name,
  }));
  const workflowStatusOptions = TASK_WORKFLOW_STATUSES.map((status) => ({
    value: status,
    label: TASK_STATUS_META[status].label,
  }));
  const checklistItemOptions = useMemo(
    () => [...templateItems]
      .filter((item) => item.execution_type !== 'stage')
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        value: item.id,
        label: item.stage_name ? `${item.title} (${item.stage_name})` : item.title,
      })),
    [templateItems],
  );
  const stageBulkOptions = useMemo(
    () => [...templateStages]
      .filter((s) => s.is_active)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ value: s.id, label: s.name })),
    [templateStages],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.table || [];
    return (data?.table || []).filter((item) =>
      [item.lead_name, item.campaign_name, item.assignee_name || '', item.template_name]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [data, search]);

  const filteredByStatus = useMemo(() => {
    const map = new Map<string, SubfunnelWorkspaceItem[]>();
    for (const item of filteredItems) {
      const stageKey = item.board_stage_key || `stage-${item.current_template_stage_id ?? 'unassigned'}`;
      if (!map.has(stageKey)) map.set(stageKey, []);
      map.get(stageKey)!.push(item);
    }
    return map;
  }, [filteredItems]);

  const selectedSet = useMemo(() => new Set(selectedRowKeys), [selectedRowKeys]);

  function toggleSelect(id: number, checked: boolean) {
    setSelectedRowKeys((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((k) => k !== id)));
  }

  function selectAllVisible() {
    setSelectedRowKeys(filteredItems.map((x) => x.id));
  }

  function clearSelection() {
    setSelectedRowKeys([]);
  }

  async function runBulkDelete() {
    if (!selectedRowKeys.length) return;
    Modal.confirm({
      title: `Удалить ${selectedRowKeys.length} задач?`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const result = await bulkDelete.mutateAsync(selectedRowKeys);
          message.success(`Удалено задач: ${result.deleted ?? 0}`);
          clearSelection();
        } catch {
          message.error('Не удалось удалить задачи');
        }
      },
    });
  }

  async function runBulkUpdate(payload: {
    assignee?: number | null;
    due_at?: string | null;
    clear_due_at?: boolean;
    stage_id?: number | null;
    status?: TaskWorkflowStatus;
  }) {
    if (!selectedRowKeys.length) return;
    try {
      const result = await bulkUpdate.mutateAsync({ ids: selectedRowKeys, ...payload });
      const skipped = result.skipped?.length || 0;
      if (skipped > 0) {
        message.warning(`Обновлено: ${result.updated}. Пропущено: ${skipped}.`);
      } else {
        message.success(`Обновлено задач: ${result.updated}`);
      }
      setBulkModal(null);
      bulkForm.resetFields();
      clearSelection();
    } catch {
      message.error('Не удалось выполнить массовое действие');
    }
  }

  async function runBulkChecklist(payload: {
    template_item_id: number;
    is_completed?: boolean;
    text_value?: string;
  }) {
    if (!selectedRowKeys.length) return;
    try {
      const result = await bulkChecklist.mutateAsync({ ids: selectedRowKeys, ...payload });
      const skipped = result.skipped?.length || 0;
      if (result.updated_tasks === 0 && skipped > 0) {
        message.warning(`Изменений нет. Пропущено: ${skipped}.`);
      } else if (skipped > 0) {
        message.warning(`Обновлено задач: ${result.updated_tasks}. Пропущено: ${skipped}.`);
      } else {
        message.success(`Обновлено задач: ${result.updated_tasks}`);
      }
      setBulkModal(null);
      bulkForm.resetFields();
      clearSelection();
    } catch {
      message.error('Не удалось обновить чек-лист');
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const payload = event.active.data.current as TaskDragPayload | undefined;
    if (!payload?.taskId) return;
    const found = (data?.table || []).find((x) => x.id === payload.taskId) ?? null;
    setActiveDragItem(found);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;
    const payload = active.data.current as TaskDragPayload | undefined;
    if (!payload?.taskId) return;
    const overId = String(over.id);
    if (!overId.startsWith('stage-')) return;
    if (payload.stageKey === overId) return;
    const stageMatch = overId.match(/^stage-(\d+)$/);
    if (!stageMatch) {
      if (overId === 'stage-unassigned') {
        bulkUpdate.mutate(
          { ids: [payload.taskId], stage_id: null },
          {
            onSuccess: () => message.success('Этап задачи очищен'),
            onError: () => message.error('Не удалось убрать этап задачи'),
          },
        );
        return;
      }
      message.warning('Нельзя перенести задачу в эту колонку');
      return;
    }
    setTaskStage.mutate(
      { id: payload.taskId, stage_id: Number(stageMatch[1]) },
      {
        onSuccess: () => message.success('Этап задачи обновлён'),
        onError: () => message.error('Не удалось перенести задачу'),
      },
    );
  }

  const listColumns: ColumnsType<SubfunnelWorkspaceItem> = [
    {
      title: 'Лид',
      dataIndex: 'lead_name',
      key: 'lead_name',
      render: (name: string, row) => (
        row.lead_id ? (
          <Typography.Link
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/campaigns/${row.campaign_id}/leads/${row.lead_id}`);
            }}
          >
            {name}
          </Typography.Link>
        ) : name
      ),
    },
    { title: 'Кампания', dataIndex: 'campaign_name', key: 'campaign_name', ellipsis: true },
    { title: 'Роль', dataIndex: 'role_name', key: 'role_name', render: (v) => v || '—' },
    {
      title: 'Этап задачи',
      key: 'task_stage',
      render: (_, row) => row.current_template_stage_name || '—',
    },
    { title: 'Этап лида', dataIndex: 'stage_name', key: 'stage_name', render: (v) => v || '—' },
    { title: 'Исполнитель', dataIndex: 'assignee_name', key: 'assignee_name', render: (v) => v || '—' },
    {
      title: 'Срок',
      dataIndex: 'due_at',
      key: 'due_at',
      width: 110,
      render: (v: string | null, row) => (
        <Space size={4}>
          {v ? new Date(v).toLocaleDateString('ru-RU') : '—'}
          {row.is_overdue && <Tag color="red">!</Tag>}
        </Space>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: string) => TASK_STATUS_META[normalizeTaskStatus(s)]?.label || s,
    },
    {
      title: 'Чек-лист',
      key: 'checklist',
      width: 100,
      render: (_, row) => {
        const cp = row.checklist_progress;
        if (!cp || cp.total === 0) return '—';
        return `${cp.completed}/${cp.total}`;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_, row) => (
        <Button
          type="text"
          size="small"
          icon={<ExportOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            setEditingTask(row);
          }}
        />
      ),
    },
  ];

  if (isLoading) return <div style={{ textAlign: 'center', paddingTop: 60 }}><Spin size="large" /></div>;

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Не удалось загрузить задачи"
        description={getAxiosErrorMessage(error)}
        action={
          <Button size="small" type="primary" onClick={() => refetch()}>
            Повторить
          </Button>
        }
      />
    );
  }

  const bulkBusy = bulkUpdate.isPending || bulkChecklist.isPending || bulkDelete.isPending || patchTask.isPending || setTaskStage.isPending;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Задачи
        </Typography.Title>
        <Segmented
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          options={[
            { value: 'kanban', icon: <AppstoreOutlined />, label: 'Доска' },
            { value: 'list', icon: <UnorderedListOutlined />, label: 'Список' },
          ]}
        />
      </div>

      <Row gutter={16} className="kanban-stats-row">
        <Col span={8}>
          <Card size="small"><Statistic title="Всего задач" value={data?.totals.all || 0} prefix={<AppstoreOutlined />} /></Card>
        </Col>
        <Col span={8}>
          <Card size="small"><Statistic title="Просрочено" value={data?.totals.overdue || 0} prefix={<FieldTimeOutlined />} valueStyle={{ color: '#cf1322' }} /></Card>
        </Col>
        <Col span={8}>
          <Card size="small"><Statistic title="Исполнителей" value={new Set((data?.table || []).map((x) => x.assignee_id).filter(Boolean)).size} prefix={<TeamOutlined />} /></Card>
        </Col>
      </Row>

      <Space className="kanban-filters" wrap>
        <Input
          placeholder="Поиск по лиду/кампании/исполнителю"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 320 }}
          allowClear
        />
        <Select allowClear style={{ width: 220 }} value={campaign} options={campaignOptions} placeholder="Кампания" onChange={setCampaign} />
        <Select allowClear style={{ width: 220 }} value={role} options={roleOptions} placeholder="Роль" onChange={setRole} />
        <Select allowClear style={{ width: 240 }} value={assignee} options={userOptions} placeholder="Исполнитель" onChange={setAssignee} />
        <Select
          allowClear
          style={{ width: 220 }}
          value={statusFilter}
          placeholder="Этап задачи"
          onChange={setStatusFilter}
          options={stageFilterOptions}
        />
        <Select
          allowClear
          style={{ width: 180 }}
          value={overdue}
          placeholder="Просрочка"
          onChange={(v) => setOverdue(v)}
          options={[
            { value: true, label: 'Только просроченные' },
            { value: false, label: 'Без фильтра просрочки' },
          ]}
        />
        {filteredItems.length > 0 && (
          <Button size="small" onClick={selectAllVisible} disabled={bulkBusy}>
            Выбрать все ({filteredItems.length})
          </Button>
        )}
      </Space>

      <Tabs
        activeKey={activeTemplate ? String(activeTemplate) : undefined}
        onChange={(key) => {
          setActiveTemplate(Number(key));
          setStatusFilter(undefined);
        }}
        items={(data?.templates || []).map((t) => ({
          key: String(t.id),
          label: `${t.name} (${t.count})`,
        }))}
      />

      {selectedRowKeys.length > 0 && (
        <TaskBulkToolbar
          count={selectedRowKeys.length}
          busy={bulkBusy}
          onAssignee={() => setBulkModal('assignee')}
          onDue={() => setBulkModal('due')}
          onStatus={() => setBulkModal('status')}
          onStage={() => setBulkModal('stage')}
          onChecklist={() => setBulkModal('checklist')}
          onClearAssignee={() => runBulkUpdate({ assignee: null })}
          onClearDue={() => runBulkUpdate({ clear_due_at: true })}
          onDelete={runBulkDelete}
          onClearSelection={clearSelection}
        />
      )}

      {viewMode === 'kanban' ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveDragItem(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban-board">
            {(data?.columns || []).map((col) => {
              const items = filteredByStatus.get(col.status) || [];
              const columnIds = items.map((item) => item.id);
              return (
                <div key={col.status} className="kanban-column">
                  <KanbanColumnHeader
                    count={items.length}
                    columnIds={columnIds}
                    selectedIds={selectedRowKeys}
                    onSelectionChange={setSelectedRowKeys}
                    disabled={bulkBusy}
                  >
                    <h4>{col.stage_name}</h4>
                  </KanbanColumnHeader>
                  <KanbanDropColumn id={col.status}>
                    {items.length === 0 ? (
                      <Typography.Text type="secondary">Пусто</Typography.Text>
                    ) : (
                      items.map((item) => (
                        <TaskBoardCard
                          key={item.id}
                          item={item}
                          selected={selectedSet.has(item.id)}
                          onToggleSelect={toggleSelect}
                          onOpen={setEditingTask}
                          onOpenLead={(row) => window.open(`/campaigns/${row.campaign_id}/leads/${row.lead_id}`, '_blank', 'noopener,noreferrer')}
                          dragDisabled={patchTask.isPending || bulkBusy}
                          selectDisabled={bulkBusy}
                        />
                      ))
                    )}
                  </KanbanDropColumn>
                </div>
              );
            })}
          </div>
          <DragOverlay>
            {activeDragItem ? (
              <div className="kanban-card kanban-card--task kanban-card--drag-overlay">
                <TaskCardFace item={activeDragItem} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card>
          <Table
            rowKey="id"
            size="small"
            loading={bulkBusy}
            dataSource={filteredItems}
            columns={listColumns}
            pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: [25, 50, 100] }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => {
                if (bulkBusy) return;
                setSelectedRowKeys(keys as number[]);
              },
              getCheckboxProps: () => ({ disabled: bulkBusy }),
              selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
            }}
            onRow={(record) => ({
              onClick: () => setEditingTask(record),
              style: { cursor: 'pointer' },
            })}
          />
        </Card>
      )}

      <TaskEditDrawer
        open={!!editingTask}
        taskId={editingTask?.id ?? null}
        campaignId={editingTask?.campaign_id}
        leadId={editingTask?.lead_id ?? undefined}
        leadName={editingTask?.lead_name}
        onClose={() => setEditingTask(null)}
      />

      <Modal
        title="Назначить исполнителя"
        open={bulkModal === 'assignee'}
        onCancel={() => { setBulkModal(null); bulkForm.resetFields(); }}
        onOk={async () => {
          const vals = await bulkForm.validateFields();
          await runBulkUpdate({ assignee: vals.assignee ?? null });
        }}
        confirmLoading={bulkBusy}
        destroyOnClose
      >
        <Form form={bulkForm} layout="vertical">
          <Form.Item name="assignee" label="Исполнитель">
            <Select allowClear showSearch optionFilterProp="label" options={userOptions} placeholder="Не назначен" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Установить срок"
        open={bulkModal === 'due'}
        onCancel={() => { setBulkModal(null); bulkForm.resetFields(); }}
        onOk={async () => {
          const vals = await bulkForm.validateFields();
          await runBulkUpdate({
            due_at: vals.due_at ? vals.due_at.toISOString() : null,
          });
        }}
        confirmLoading={bulkBusy}
        destroyOnClose
      >
        <Form form={bulkForm} layout="vertical">
          <Form.Item name="due_at" label="Срок" rules={[{ required: true, message: 'Укажите дату' }]}>
            <DatePicker showTime format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Сменить статус"
        open={bulkModal === 'status'}
        onCancel={() => { setBulkModal(null); bulkForm.resetFields(); }}
        onOk={async () => {
          const vals = await bulkForm.validateFields();
          await runBulkUpdate({ status: vals.status });
        }}
        confirmLoading={bulkBusy}
        destroyOnClose
      >
        <Form form={bulkForm} layout="vertical">
          <Form.Item name="status" label="Статус" rules={[{ required: true, message: 'Выберите статус' }]}>
            <Select options={workflowStatusOptions} placeholder="Статус задачи" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Сменить этап"
        open={bulkModal === 'stage'}
        onCancel={() => { setBulkModal(null); bulkForm.resetFields(); }}
        onOk={async () => {
          const vals = await bulkForm.validateFields();
          await runBulkUpdate({ stage_id: vals.stage_id ?? null });
        }}
        confirmLoading={bulkBusy}
        destroyOnClose
      >
        <Form form={bulkForm} layout="vertical">
          <Form.Item name="stage_id" label="Этап задачи">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={stageBulkOptions}
              placeholder="Без этапа"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Изменить пункт чек-листа"
        open={bulkModal === 'checklist'}
        onCancel={() => { setBulkModal(null); bulkForm.resetFields(); }}
        onOk={async () => {
          const vals = await bulkForm.validateFields();
          const payload: {
            template_item_id: number;
            is_completed?: boolean;
            text_value?: string;
          } = { template_item_id: vals.template_item_id };
          if (vals.mark_status === 'done') payload.is_completed = true;
          if (vals.mark_status === 'undone') payload.is_completed = false;
          if (vals.update_text) payload.text_value = vals.text_value || '';
          if (!('is_completed' in payload) && !('text_value' in payload)) {
            message.warning('Укажите выполнение или значение пункта');
            return;
          }
          await runBulkChecklist(payload);
        }}
        confirmLoading={bulkBusy}
        destroyOnClose
      >
        <Form
          form={bulkForm}
          layout="vertical"
          initialValues={{ mark_status: 'keep', update_text: false }}
        >
          <Form.Item
            name="template_item_id"
            label="Пункт чек-листа"
            rules={[{ required: true, message: 'Выберите пункт' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={checklistItemOptions}
              placeholder="Выберите пункт"
              notFoundContent="Нет пунктов для текущего шаблона"
            />
          </Form.Item>
          <Form.Item name="mark_status" label="Выполнение">
            <Select
              options={[
                { value: 'keep', label: 'Не менять' },
                { value: 'done', label: 'Отметить выполненным' },
                { value: 'undone', label: 'Снять отметку' },
              ]}
            />
          </Form.Item>
          <Form.Item name="update_text" valuePropName="checked">
            <Checkbox>Изменить значение / комментарий</Checkbox>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.update_text !== next.update_text}>
            {({ getFieldValue }) => getFieldValue('update_text') ? (
              <Form.Item name="text_value" label="Значение">
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} placeholder="Комментарий / данные" />
              </Form.Item>
            ) : null}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

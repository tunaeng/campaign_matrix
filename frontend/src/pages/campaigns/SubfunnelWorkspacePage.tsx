import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CalendarOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import TaskEditDrawer from '../../components/TaskEditDrawer';
import {
  useBulkUpdateLeadSubfunnels,
  useCampaigns,
  useRoles,
  useSetLeadSubfunnelStage,
  useSubfunnelWorkspace,
  useUsers,
} from '../../api/hooks';
import { getAxiosErrorMessage } from '../../api/errorMessage';
import type { SubfunnelWorkspaceItem } from '../../types';
import './BoardStyles.css';

type TaskDragPayload = { type: 'task'; taskId: number; stageId: number | null };
type ViewMode = 'kanban' | 'list';
type BulkModalKind = 'assignee' | 'due' | 'stage' | null;

const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  todo: { label: 'К выполнению', color: 'default' },
  in_progress: { label: 'В работе', color: 'processing' },
  blocked: { label: 'Заблокирована', color: 'warning' },
  done: { label: 'Готово', color: 'success' },
};

function TaskCardFace({ item }: { item: SubfunnelWorkspaceItem }) {
  const status = TASK_STATUS_META[item.status] || { label: item.status, color: 'default' };
  const checklist = item.checklist_progress;
  const checklistPct = checklist && checklist.total > 0
    ? Math.round((checklist.completed / checklist.total) * 100)
    : null;

  return (
    <div className={`kanban-task-card-body kanban-task-card-body--${item.status}`}>
      <div className="kanban-task-card-head">
        <div className="kanban-task-card-head-main">
          <div className="kanban-task-card-template">{item.template_name}</div>
          <div className="kanban-task-card-subject">
            {item.is_region_task && (
              <Tag color="cyan" className="kanban-task-card-region-tag">Регион</Tag>
            )}
            <span className="kanban-task-card-subject-name">{item.lead_name}</span>
          </div>
        </div>
        <div className="kanban-task-card-badges">
          <Tag color={status.color} className="kanban-task-card-status-tag">{status.label}</Tag>
          {item.is_overdue && <Tag color="red">Просрочено</Tag>}
          {!item.is_available && <Tag>Недоступна</Tag>}
        </div>
      </div>

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
    data: { type: 'task', taskId: item.id, stageId: item.current_template_stage_id ?? null } satisfies TaskDragPayload,
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
  onStage: () => void;
  onClearAssignee: () => void;
  onClearDue: () => void;
  onClearSelection: () => void;
}

function TaskBulkToolbar({
  count,
  busy,
  onAssignee,
  onDue,
  onStage,
  onClearAssignee,
  onClearDue,
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
          <Button size="small" icon={<NodeIndexOutlined />} disabled={busy} onClick={onStage}>
            Этап…
          </Button>
          <Button size="small" disabled={busy} onClick={onClearAssignee}>
            Снять исполнителя
          </Button>
          <Button size="small" disabled={busy} onClick={onClearDue}>
            Снять срок
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const setTaskStage = useSetLeadSubfunnelStage();
  const bulkUpdate = useBulkUpdateLeadSubfunnels();

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [campaign, setCampaign] = useState<number | undefined>();
  const [role, setRole] = useState<number | undefined>();
  const [assignee, setAssignee] = useState<number | undefined>();
  const [status, setStatus] = useState<number | undefined>();
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
  const { data, isLoading, isError, error, refetch } = useSubfunnelWorkspace({
    view_mode: viewMode === 'kanban' ? 'kanban' : 'table',
    campaign,
    template: activeTemplate,
    role,
    assignee,
    status,
    overdue,
  });

  useEffect(() => {
    if (!data?.templates?.length) return;
    if (activeTemplate && data.templates.some((t) => t.id === activeTemplate)) return;
    const fromApi = data.active_template_id || data.templates[0].id;
    setActiveTemplate(fromApi);
  }, [data, activeTemplate]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [activeTemplate, campaign, role, assignee, status, overdue]);

  const campaignOptions = (campaignsData?.results || []).map((c) => ({ value: c.id, label: c.name }));
  const roleOptions = (rolesData?.results || []).map((r) => ({ value: r.id, label: r.name }));
  const userOptions = (usersData?.results || []).map((u) => ({ value: u.id, label: u.full_name || u.username }));
  const stageOptions = (data?.columns || []).map((col) => ({ value: col.stage_id, label: col.stage_name }));

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

  const filteredByStage = useMemo(() => {
    const map = new Map<number, SubfunnelWorkspaceItem[]>();
    for (const item of filteredItems) {
      const stageId = item.current_template_stage_id;
      if (!stageId) continue;
      if (!map.has(stageId)) map.set(stageId, []);
      map.get(stageId)!.push(item);
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

  async function runBulkUpdate(payload: {
    assignee?: number | null;
    due_at?: string | null;
    clear_due_at?: boolean;
    stage_id?: number | null;
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
    const newStageId = Number(overId.slice('stage-'.length));
    if (!Number.isFinite(newStageId) || newStageId <= 0) return;
    if (payload.stageId === newStageId) return;

    setTaskStage.mutate(
      { id: payload.taskId, stage_id: newStageId },
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
        <Typography.Link
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/campaigns/${row.campaign_id}/leads/${row.lead_id}`);
          }}
        >
          {name}
        </Typography.Link>
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
      render: (s: string) => TASK_STATUS_META[s]?.label || s,
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

  const bulkBusy = bulkUpdate.isPending;

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
          value={status}
          placeholder="Этап задачи"
          onChange={setStatus}
          options={stageOptions}
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
          setStatus(undefined);
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
          onStage={() => setBulkModal('stage')}
          onClearAssignee={() => runBulkUpdate({ assignee: null })}
          onClearDue={() => runBulkUpdate({ clear_due_at: true })}
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
              const items = filteredByStage.get(col.stage_id) || [];
              return (
                <div key={col.stage_id} className="kanban-column">
                  <div className="kanban-column-header">
                    <h4>{col.stage_name}</h4>
                    <span className="kanban-column-count">{items.length}</span>
                  </div>
                  <KanbanDropColumn id={`stage-${col.stage_id}`}>
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
                          onOpenLead={(row) => navigate(`/campaigns/${row.campaign_id}/leads/${row.lead_id}`)}
                          dragDisabled={setTaskStage.isPending || bulkBusy}
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
        title="Сменить этап задачи"
        open={bulkModal === 'stage'}
        onCancel={() => { setBulkModal(null); bulkForm.resetFields(); }}
        onOk={async () => {
          const vals = await bulkForm.validateFields();
          await runBulkUpdate({ stage_id: vals.stage_id });
        }}
        confirmLoading={bulkBusy}
        destroyOnClose
      >
        <Form form={bulkForm} layout="vertical">
          <Form.Item name="stage_id" label="Этап" rules={[{ required: true, message: 'Выберите этап' }]}>
            <Select options={stageOptions} placeholder="Этап шаблона" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Row, Col, Statistic, Card, Tag, Input, Select, Space, Progress, Tabs, Switch, Typography, App, Checkbox, Button, Modal, Form,
} from 'antd';
import {
  TeamOutlined, CheckCircleOutlined, StopOutlined, SearchOutlined,
  ClockCircleOutlined, CheckOutlined, MessageOutlined, AimOutlined,
  StarFilled, CarryOutOutlined,
} from '@ant-design/icons';
import TaskEditDrawer from '../../components/TaskEditDrawer';
import KanbanColumnHeader from '../../components/KanbanColumnHeader';
import BulkSelectionToolbar from '../../components/BulkSelectionToolbar';
import { useFunnel, usePatchLead, useBulkUpdateLeads, useBulkDeleteLeads } from '../../api/hooks';
import type { CampaignDetail, Lead, LeadPrimaryContactBrief } from '../../types';
import { toggleItemSelection } from '../../utils/kanbanSelection';
import ContactPreviewModal from '../../components/ContactPreviewModal';
import LeadInteractionsHistoryModal from '../../components/LeadInteractionsHistoryModal';
import DemandQuotaPreview, { leadToDemandBreakdown } from '../../components/DemandQuotaPreview';
import './BoardStyles.css';

interface Props {
  campaign: CampaignDetail;
}

function addBusinessDays(startDate: string, days: number): Date {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function deadlineClass(deadlineDate: Date | null): string {
  if (!deadlineDate) return '';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'kanban-deadline-overdue';
  if (diff <= 3) return 'kanban-deadline-warn';
  return 'kanban-deadline-ok';
}

function primaryContactLabel(c: LeadPrimaryContactBrief): string {
  if (c.type === 'department') {
    return c.department_name || c.full_name || 'Контакт';
  }
  return c.full_name || 'Контакт';
}

function primaryLeadRegionLabel(l: Lead): string | null {
  const fromLead = l.region_name?.trim();
  if (fromLead) return fromLead;
  const fallback = l.organization_region?.trim();
  return fallback || null;
}

type LeadDragPayload = { type: 'lead'; leadId: number; stageKey: number; campaignId: number };

function KanbanDropColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`kanban-cards${isOver ? ' kanban-droppable-over' : ''}`}>
      {children}
    </div>
  );
}

interface LeadCardFaceProps {
  l: Lead;
  showDetails: boolean;
  setContactPreview: (v: { contact: LeadPrimaryContactBrief; leadId: number } | null) => void;
  setInteractionModalLead: (v: { id: number; orgName: string } | null) => void;
  onOpenTask?: (taskId: number) => void;
  includeCollapsedContact?: boolean;
  dragPreview?: boolean;
}

function LeadCardFace({
  l,
  showDetails,
  setContactPreview,
  setInteractionModalLead,
  onOpenTask,
  includeCollapsedContact = false,
  dragPreview = false,
}: LeadCardFaceProps) {
  const pct = l.checklist_progress
    ? (l.checklist_progress.total > 0 ? Math.round((l.checklist_progress.completed / l.checklist_progress.total) * 100) : 0)
    : 0;
  const checklist = l.checklist_summary || [];
  const tasks = l.tasks_summary || [];
  const lastInt = l.last_interaction;
  const region = primaryLeadRegionLabel(l);

  return (
    <>
      <div className="kanban-card-title">{l.organization_name}</div>
      <div className="kanban-card-tags">
        {region && (
          <Tag>{region}</Tag>
        )}
        {l.forwarded_from && (
          <Tag color="gold">Передано от: {l.forwarded_from}</Tag>
        )}
        {(l.tag_names || []).map((name) => (
          <Tag key={name} color="cyan">{name}</Tag>
        ))}
      </div>
      {l.checklist_progress && l.checklist_progress.total > 0 && (
        <Progress
          percent={pct}
          size="small"
          format={() => `${l.checklist_progress!.completed}/${l.checklist_progress!.total}`}
          style={{ marginTop: 4 }}
        />
      )}
      <div className="kanban-card-stats">
        {l.manager_name && (
          <span className="kanban-card-stat">
            <TeamOutlined /> {l.manager_name}
          </span>
        )}
      </div>
      <div style={{ marginTop: 4 }}>
        <DemandQuotaPreview breakdown={leadToDemandBreakdown(l)} />
      </div>

      {showDetails && (
        <div className="kanban-card-details">
          {l.primary_contact && (
            <div
              style={{ marginBottom: 6 }}
              onClick={
                dragPreview
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      setContactPreview({ contact: l.primary_contact!, leadId: l.id });
                    }
              }
            >
              <StarFilled style={{ color: '#faad14', fontSize: 11, marginRight: 4 }} />
              {dragPreview ? (
                <span style={{ fontSize: 11 }}>{primaryContactLabel(l.primary_contact)}</span>
              ) : (
                <Typography.Link style={{ fontSize: 11 }}>
                  {primaryContactLabel(l.primary_contact)}
                </Typography.Link>
              )}
            </div>
          )}
          {checklist.length > 0 && (
            <div className="kanban-card-checklist">
              {checklist.map((item, idx) => (
                <div key={idx} className={`kanban-checklist-item ${item.done ? 'done' : ''}`}>
                  <CheckOutlined style={{ fontSize: 10, color: item.done ? '#52c41a' : '#d9d9d9' }} />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          )}
          {tasks.length > 0 && (
            <div className="kanban-card-tasks">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`kanban-task-item ${task.done ? 'done' : ''}`}
                  onClick={
                    dragPreview || !onOpenTask
                      ? undefined
                      : (e) => {
                          e.stopPropagation();
                          onOpenTask(task.id);
                        }
                  }
                  style={{ cursor: dragPreview || !onOpenTask ? 'default' : 'pointer' }}
                  role="presentation"
                >
                  <div className="kanban-task-item-main">
                    <CarryOutOutlined className="kanban-task-item-icon" />
                    <span className="kanban-task-item-title">{task.template_name}</span>
                  </div>
                  <div className="kanban-task-item-meta">
                    {task.stage_name && (
                      <Tag className="kanban-task-item-stage">{task.stage_name}</Tag>
                    )}
                    {task.progress.total > 0 && (
                      <span className="kanban-task-item-progress">
                        {task.progress.completed}/{task.progress.total}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div
            className="kanban-card-interaction"
            onClick={
              dragPreview
                ? undefined
                : (e) => {
                    e.stopPropagation();
                    setInteractionModalLead({ id: l.id, orgName: l.organization_name });
                  }
            }
            style={{ cursor: dragPreview ? 'default' : 'pointer' }}
            role="presentation"
          >
            <MessageOutlined style={{ fontSize: 10, color: '#1677ff' }} />
            {lastInt ? (
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text style={{ fontSize: 11 }}>
                  {lastInt.contact_person}
                  {lastInt.date && <> · {new Date(lastInt.date).toLocaleDateString('ru-RU')}</>}
                  {lastInt.channel && <> · {lastInt.channel}</>}
                </Typography.Text>
                {lastInt.result && (
                  <Typography.Paragraph
                    ellipsis={{ rows: 2, expandable: false }}
                    style={{ marginBottom: 0, marginTop: 4, fontSize: 11 }}
                    type="secondary"
                  >
                    {lastInt.result}
                  </Typography.Paragraph>
                )}
              </div>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                Нет взаимодействий — нажмите для списка
              </Typography.Text>
            )}
          </div>
        </div>
      )}
      {includeCollapsedContact && !showDetails && l.primary_contact && (
        <div
          style={{ marginTop: 6, fontSize: 11 }}
          onClick={
            dragPreview
              ? undefined
              : (e) => {
                  e.stopPropagation();
                  setContactPreview({ contact: l.primary_contact!, leadId: l.id });
                }
          }
        >
          <StarFilled style={{ color: '#faad14', marginRight: 4 }} />
          {dragPreview ? (
            <span style={{ fontSize: 11 }}>{primaryContactLabel(l.primary_contact)}</span>
          ) : (
            <Typography.Link style={{ fontSize: 11 }}>
              {primaryContactLabel(l.primary_contact)}
            </Typography.Link>
          )}
        </div>
      )}
    </>
  );
}

interface LeadBoardCardProps {
  lead: Lead;
  campaignId: number;
  navigate: ReturnType<typeof useNavigate>;
  showDetails: boolean;
  setContactPreview: (v: { contact: LeadPrimaryContactBrief; leadId: number } | null) => void;
  setInteractionModalLead: (v: { id: number; orgName: string } | null) => void;
  onOpenTask: (taskId: number, lead: Lead) => void;
  dragDisabled: boolean;
  includeCollapsedContact?: boolean;
  selected: boolean;
  onToggleSelect: (id: number, checked: boolean) => void;
}

function LeadBoardCard({
  lead: l,
  campaignId,
  navigate,
  showDetails,
  setContactPreview,
  setInteractionModalLead,
  onOpenTask,
  dragDisabled,
  includeCollapsedContact = false,
  selected,
  onToggleSelect,
}: LeadBoardCardProps) {
  const stageKey = l.current_stage ?? 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lead-${l.id}`,
    disabled: dragDisabled,
    data: { type: 'lead', leadId: l.id, stageKey, campaignId } satisfies LeadDragPayload,
  });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'kanban-card--source-dragging' : undefined}
      {...listeners}
      {...attributes}
    >
      <div
        className={`kanban-card kanban-card--selectable${selected ? ' kanban-card--selected' : ''}`}
        onClick={() => navigate(`/campaigns/${campaignId}/leads/${l.id}`)}
      >
        <div className="kanban-card-select-toolbar">
          <Checkbox
            className="kanban-card-select"
            checked={selected}
            disabled={dragDisabled}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggleSelect(l.id, e.target.checked)}
          />
        </div>
        <div className="kanban-card-selectable-body">
          <LeadCardFace
            l={l}
            showDetails={showDetails}
            setContactPreview={setContactPreview}
            setInteractionModalLead={setInteractionModalLead}
            onOpenTask={(taskId) => onOpenTask(taskId, l)}
            includeCollapsedContact={includeCollapsedContact}
          />
        </div>
      </div>
    </div>
  );
}

export default function LeadBoardView({ campaign }: Props) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const patchLead = usePatchLead();
  const bulkUpdateLeads = useBulkUpdateLeads();
  const bulkDeleteLeads = useBulkDeleteLeads();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const [search, setSearch] = useState('');
  const [managerFilter, setManagerFilter] = useState<number>();
  const [activeQueue, setActiveQueue] = useState<string>('all');
  const [showDetails, setShowDetails] = useState(true);
  const [contactPreview, setContactPreview] = useState<{
    contact: LeadPrimaryContactBrief;
    leadId: number;
  } | null>(null);
  const [interactionModalLead, setInteractionModalLead] = useState<{
    id: number;
    orgName: string;
  } | null>(null);
  const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [editingTask, setEditingTask] = useState<{
    id: number;
    leadId: number;
    leadName: string;
  } | null>(null);
  const [bulkStageModalOpen, setBulkStageModalOpen] = useState(false);
  const [bulkStageForm] = Form.useForm();

  const funnelId = campaign.campaign_funnels?.[0]?.funnel;
  const { data: funnelDetail } = useFunnel(funnelId!);

  useEffect(() => {
    setSelectedLeadIds([]);
  }, [search, managerFilter, activeQueue]);

  const selectedLeadSet = useMemo(() => new Set(selectedLeadIds), [selectedLeadIds]);

  function toggleLeadSelect(id: number, checked: boolean) {
    setSelectedLeadIds((prev) => toggleItemSelection(prev, id, checked));
  }

  function clearLeadSelection() {
    setSelectedLeadIds([]);
  }

  const bulkBusy = bulkUpdateLeads.isPending || bulkDeleteLeads.isPending || patchLead.isPending;

  const stageOptions = useMemo(
    () => [...(funnelDetail?.stages || [])]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ value: s.id, label: s.name })),
    [funnelDetail],
  );

  async function runBulkMoveStage() {
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
      clearLeadSelection();
    } catch {
      message.error('Не удалось перенести лидов');
    }
  }

  async function runBulkDelete() {
    if (!selectedLeadIds.length) return;
    try {
      const result = await bulkDeleteLeads.mutateAsync(selectedLeadIds);
      message.success(`Удалено лидов: ${result.deleted ?? 0}`);
      clearLeadSelection();
    } catch {
      message.error('Не удалось удалить лидов');
    }
  }

  const leads = campaign.leads || [];

  const managers = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of leads) {
      if (l.manager && l.manager_name) m.set(l.manager, l.manager_name);
    }
    return Array.from(m.entries()).map(([id, name]) => ({ value: id, label: name }));
  }, [leads]);

  const filtered = useMemo(() => {
    let list = leads;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => l.organization_name.toLowerCase().includes(q));
    }
    if (managerFilter) {
      list = list.filter(l => l.manager === managerFilter);
    }
    if (activeQueue !== 'all') {
      const queueId = Number(activeQueue);
      list = list.filter(l => l.queue === queueId);
    }
    return list;
  }, [leads, search, managerFilter, activeQueue]);

  const stages: { id: number; name: string; order: number; is_rejection: boolean; deadline_days: number }[] = useMemo(() => {
    if (!funnelDetail?.stages) return [];
    return [...funnelDetail.stages].sort((a, b) => a.order - b.order);
  }, [funnelDetail]);

  const normalStages = stages.filter(s => !s.is_rejection);
  const rejectionStage = stages.find(s => s.is_rejection);

  const columns = [...normalStages, ...(rejectionStage ? [rejectionStage] : [])];

  const grouped = useMemo(() => {
    const map: Record<number, Lead[]> = {};
    for (const s of columns) {
      map[s.id] = [];
    }
    map[0] = []; // for leads with no stage
    for (const l of filtered) {
      const stageId = l.current_stage || 0;
      if (map[stageId]) {
        map[stageId].push(l);
      } else {
        map[0].push(l);
      }
    }
    return map;
  }, [filtered, columns]);

  const selectedQueue = activeQueue !== 'all'
    ? campaign.queues.find(q => q.id === Number(activeQueue))
    : campaign.queues[0];

  function getStageDeadline(stageId: number): Date | null {
    if (!selectedQueue?.start_date) return null;
    const sd = selectedQueue.stage_deadlines?.find(d => d.funnel_stage === stageId);
    if (!sd) return null;
    return addBusinessDays(selectedQueue.start_date, sd.deadline_days);
  }

  const totalLeads = leads.length;
  const totalForecast = leads.reduce((s, l) => s + (l.forecast_demand || 0), 0);
  const rejectedCount = leads.filter(l => l.current_stage_is_rejection).length;
  const completedChecklist = leads.filter(l => {
    if (!l.checklist_progress) return false;
    return l.checklist_progress.total > 0 && l.checklist_progress.completed === l.checklist_progress.total;
  }).length;

  const queueTabs = [
    { key: 'all', label: 'Все очереди' },
    ...campaign.queues.map(q => ({
      key: String(q.id),
      label: q.name || `Очередь ${q.queue_number}`,
    })),
  ];

  function handleLeadDragStart(event: DragStartEvent) {
    const payload = event.active.data.current as LeadDragPayload | undefined;
    if (!payload?.leadId) return;
    const found = leads.find((x) => x.id === payload.leadId) ?? null;
    setActiveDragLead(found);
  }

  function handleLeadDragEnd(event: DragEndEvent) {
    setActiveDragLead(null);
    const { active, over } = event;
    if (!over) return;
    const payload = active.data.current as LeadDragPayload | undefined;
    if (!payload?.leadId) return;
    const overId = String(over.id);
    let targetStage: number | null;
    if (overId === 'stage-none') {
      targetStage = null;
    } else if (overId.startsWith('stage-')) {
      targetStage = Number(overId.slice('stage-'.length));
      if (Number.isNaN(targetStage)) return;
    } else {
      return;
    }
    const currentStageId = payload.stageKey === 0 ? null : payload.stageKey;
    if (targetStage === currentStageId) return;

    patchLead.mutate(
      {
        id: payload.leadId,
        campaignId: campaign.id,
        data: { current_stage: targetStage },
      },
      {
        onSuccess: () => message.success('Стадия обновлена'),
        onError: () => message.error('Не удалось перенести лид'),
      },
    );
  }

  const dragDisabled = bulkBusy;

  return (
    <div>
      <Row gutter={12} className="kanban-stats-row">
        <Col span={6}>
          <Card size="small"><Statistic title="Всего лидов" value={totalLeads} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="Прогноз потребности" value={totalForecast} prefix={<AimOutlined />} suffix="чел." /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="Чек-лист завершён" value={completedChecklist} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="В отказе" value={rejectedCount} prefix={<StopOutlined />} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
      </Row>

      <Space className="kanban-filters" wrap>
        <Input
          placeholder="Поиск организации"
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          placeholder="Менеджер"
          allowClear
          style={{ width: 200 }}
          value={managerFilter}
          onChange={setManagerFilter}
          options={managers}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Switch size="small" checked={showDetails} onChange={setShowDetails} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Детали</Typography.Text>
        </span>
      </Space>

      {campaign.queues.length > 1 && (
        <Tabs
          activeKey={activeQueue}
          onChange={setActiveQueue}
          items={queueTabs}
          size="small"
          style={{ marginBottom: 8 }}
        />
      )}

      {selectedLeadIds.length > 0 && (
        <BulkSelectionToolbar
          count={selectedLeadIds.length}
          entityLabel="лидов"
          busy={bulkBusy}
          onMoveStage={() => setBulkStageModalOpen(true)}
          moveStageLabel="Стадия…"
          onDelete={runBulkDelete}
          deleteConfirmTitle={`Удалить ${selectedLeadIds.length} лидов?`}
          onClearSelection={clearLeadSelection}
        />
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleLeadDragStart}
        onDragCancel={() => setActiveDragLead(null)}
        onDragEnd={handleLeadDragEnd}
      >
        <div className="kanban-board">
          {columns.map(stage => {
            const stageLeads = grouped[stage.id] || [];
            const columnIds = stageLeads.map((lead) => lead.id);
            const deadline = getStageDeadline(stage.id);
            const dlClass = deadlineClass(deadline);

            return (
              <div key={stage.id} className={`kanban-column ${stage.is_rejection ? 'stage-rejection' : ''}`}>
                <KanbanColumnHeader
                  count={stageLeads.length}
                  columnIds={columnIds}
                  selectedIds={selectedLeadIds}
                  onSelectionChange={setSelectedLeadIds}
                  disabled={dragDisabled}
                >
                  <h4>{stage.name}</h4>
                  {deadline && (
                    <span style={{ fontSize: 11 }} className={dlClass}>
                      <ClockCircleOutlined /> {deadline.toLocaleDateString('ru-RU')}
                    </span>
                  )}
                </KanbanColumnHeader>
                <KanbanDropColumn id={`stage-${stage.id}`}>
                  {stageLeads.map(l => (
                    <LeadBoardCard
                      key={l.id}
                      lead={l}
                      campaignId={campaign.id}
                      navigate={navigate}
                      showDetails={showDetails}
                      setContactPreview={setContactPreview}
                      setInteractionModalLead={setInteractionModalLead}
                      onOpenTask={(taskId, lead) => setEditingTask({
                        id: taskId,
                        leadId: lead.id,
                        leadName: lead.organization_name,
                      })}
                      dragDisabled={dragDisabled}
                      selected={selectedLeadSet.has(l.id)}
                      onToggleSelect={toggleLeadSelect}
                    />
                  ))}
                  {stageLeads.length === 0 && (
                    <div style={{ color: '#bbb', textAlign: 'center', padding: 20, fontSize: 13 }}>
                      Нет лидов
                    </div>
                  )}
                </KanbanDropColumn>
              </div>
            );
          })}

          {(grouped[0] || []).length > 0 && (
            <div className="kanban-column">
              <KanbanColumnHeader
                count={grouped[0].length}
                columnIds={grouped[0].map((lead) => lead.id)}
                selectedIds={selectedLeadIds}
                onSelectionChange={setSelectedLeadIds}
                disabled={dragDisabled}
              >
                <h4>Без стадии</h4>
              </KanbanColumnHeader>
              <KanbanDropColumn id="stage-none">
                {grouped[0].map(l => (
                  <LeadBoardCard
                    key={l.id}
                    lead={l}
                    campaignId={campaign.id}
                    navigate={navigate}
                    showDetails={showDetails}
                    setContactPreview={setContactPreview}
                    setInteractionModalLead={setInteractionModalLead}
                    onOpenTask={(taskId, lead) => setEditingTask({
                      id: taskId,
                      leadId: lead.id,
                      leadName: lead.organization_name,
                    })}
                    dragDisabled={dragDisabled}
                    includeCollapsedContact
                    selected={selectedLeadSet.has(l.id)}
                    onToggleSelect={toggleLeadSelect}
                  />
                ))}
              </KanbanDropColumn>
            </div>
          )}
        </div>
        <DragOverlay zIndex={1100} dropAnimation={null} style={{ cursor: 'grabbing' }}>
          {activeDragLead ? (
            <div className="kanban-card kanban-card--drag-overlay">
              <LeadCardFace
                l={activeDragLead}
                showDetails={showDetails}
                setContactPreview={setContactPreview}
                setInteractionModalLead={setInteractionModalLead}
                dragPreview
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ContactPreviewModal
        open={!!contactPreview}
        onClose={() => setContactPreview(null)}
        contact={contactPreview?.contact ?? null}
        leadLink={contactPreview ? { campaignId: campaign.id, leadId: contactPreview.leadId } : null}
      />

      <LeadInteractionsHistoryModal
        open={!!interactionModalLead}
        onClose={() => setInteractionModalLead(null)}
        leadId={interactionModalLead?.id ?? null}
        organizationName={interactionModalLead?.orgName}
      />

      <TaskEditDrawer
        open={!!editingTask}
        taskId={editingTask?.id ?? null}
        campaignId={campaign.id}
        leadId={editingTask?.leadId}
        leadName={editingTask?.leadName}
        onClose={() => setEditingTask(null)}
      />

      <Modal
        title="Перенести лидов на стадию"
        open={bulkStageModalOpen}
        onCancel={() => { setBulkStageModalOpen(false); bulkStageForm.resetFields(); }}
        onOk={runBulkMoveStage}
        confirmLoading={bulkUpdateLeads.isPending}
        destroyOnClose
      >
        <Form form={bulkStageForm} layout="vertical">
          <Form.Item name="current_stage" label="Стадия">
            <Select
              allowClear
              options={stageOptions}
              placeholder="Без стадии"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

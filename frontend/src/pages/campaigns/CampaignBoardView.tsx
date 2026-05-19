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
import { Row, Col, Statistic, Card, Tag, Input, Select, Space, Spin, Alert, Button, App, Checkbox, Typography } from 'antd';
import {
  TeamOutlined, RocketOutlined, AppstoreOutlined, AimOutlined, SearchOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useCampaigns, usePatchCampaign, useOrganizationTags } from '../../api/hooks';
import { getAxiosErrorMessage } from '../../api/errorMessage';
import type { Campaign } from '../../types';
import DemandQuotaPreview from '../../components/DemandQuotaPreview';
import EntityTagSelect from '../../components/EntityTagSelect';
import KanbanColumnHeader from '../../components/KanbanColumnHeader';
import { toggleItemSelection } from '../../utils/kanbanSelection';
import './BoardStyles.css';

function federalOperatorDisplay(c: Campaign): string | null {
  const short = c.federal_operator_short_name?.trim();
  if (short) return short;
  return c.federal_operator_name?.trim() || null;
}

function formatRuDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU');
}

function CampaignCardFace({ c }: { c: Campaign }) {
  const foLabel = federalOperatorDisplay(c);
  return (
    <>
      <div className="kanban-card-title">{c.name}</div>
      <div className="kanban-card-tags">
        {c.operational_stage === 'organization_list' && (
          <Tag color="cyan">
            {c.operational_stage_display || 'Формирование перечня организаций'}
          </Tag>
        )}
        {foLabel && (
          <Tag
            className="kanban-card-fo-tag"
            color="geekblue"
            title={c.federal_operator_name || undefined}
          >
            {foLabel}
          </Tag>
        )}
        {(c.funnel_names || []).map((fn, i) => (
          <Tag key={i} color="blue">{fn}</Tag>
        ))}
        {(c.tag_names || []).map((name) => (
          <Tag key={name}>{name}</Tag>
        ))}
      </div>
      <div className="kanban-card-stats">
        <span className="kanban-card-stat">
          <TeamOutlined /> {c.leads_count ?? 0} лидов
        </span>
        <span className="kanban-card-stat">
          {c.regions_count ?? 0} рег.
        </span>
      </div>
      {c.demand_summary ? (
        <div style={{ marginTop: 6 }}>
          <DemandQuotaPreview breakdown={c.demand_summary} />
        </div>
      ) : (
        <div className="kanban-card-stats" style={{ marginTop: 6 }}>
          <span className="kanban-card-stat">
            <AimOutlined /> план: {c.total_demand || 0}
          </span>
        </div>
      )}
      <div className="kanban-card-dates">
        <div>
          <CalendarOutlined /> Создана: {formatRuDate(c.created_at)}
        </div>
        {c.queue_periods && c.queue_periods.length > 0
          ? c.queue_periods.map((qp) => (
              <div key={qp.queue_number}>
                {c.queue_periods!.length > 1
                  ? <span>{qp.name}: </span>
                  : <span>Период: </span>
                }
                {formatRuDate(qp.start_date)} — {formatRuDate(qp.end_date)}
              </div>
            ))
          : (c.queue_period_start || c.queue_period_end) && (
              <div>
                Период: {formatRuDate(c.queue_period_start)} — {formatRuDate(c.queue_period_end)}
              </div>
            )
        }
        <div className="kanban-card-dates-muted">
          Обновлена: {formatRuDate(c.updated_at)}
        </div>
      </div>
    </>
  );
}

type BoardColumnKey = Campaign['status'] | 'organization_list';

const BOARD_COLUMNS: { key: BoardColumnKey; label: string; columnClass: string }[] = [
  { key: 'draft', label: 'Черновик', columnClass: 'status-draft' },
  {
    key: 'organization_list',
    label: 'Формирование перечня организаций',
    columnClass: 'status-organization-list',
  },
  { key: 'active', label: 'В работе', columnClass: 'status-active' },
  { key: 'paused', label: 'Приостановлена', columnClass: 'status-paused' },
  { key: 'completed', label: 'Завершена', columnClass: 'status-completed' },
];

function resolveCampaignBoardColumn(campaign: Campaign): BoardColumnKey {
  if (campaign.status === 'active' && campaign.operational_stage === 'organization_list') {
    return 'organization_list';
  }
  return campaign.status;
}

function boardColumnToStatus(column: BoardColumnKey): Campaign['status'] {
  if (column === 'organization_list') return 'active';
  return column;
}

type CampaignDragPayload = {
  type: 'campaign';
  campaignId: number;
  status: Campaign['status'];
  boardColumn: BoardColumnKey;
};

function KanbanDropColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`kanban-cards${isOver ? ' kanban-droppable-over' : ''}`}>
      {children}
    </div>
  );
}

function CampaignBoardCard({
  campaign: c,
  boardColumn,
  navigate,
  dragDisabled,
  selected,
  onToggleSelect,
}: {
  campaign: Campaign;
  boardColumn: BoardColumnKey;
  navigate: ReturnType<typeof useNavigate>;
  dragDisabled: boolean;
  selected: boolean;
  onToggleSelect: (id: number, checked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `campaign-${c.id}`,
    disabled: dragDisabled,
    data: {
      type: 'campaign',
      campaignId: c.id,
      status: c.status,
      boardColumn,
    } satisfies CampaignDragPayload,
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
        onClick={() => navigate(`/campaigns/${c.id}`)}
      >
        <div className="kanban-card-select-toolbar">
          <Checkbox
            className="kanban-card-select"
            checked={selected}
            disabled={dragDisabled}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggleSelect(c.id, e.target.checked)}
          />
        </div>
        <div className="kanban-card-selectable-body">
          <CampaignCardFace c={c} />
        </div>
      </div>
    </div>
  );
}

interface CampaignBoardViewProps {
  tagsFilter?: number[];
  onTagsFilterChange?: (tagIds: number[]) => void;
}

export default function CampaignBoardView({ tagsFilter, onTagsFilterChange }: CampaignBoardViewProps) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const patchCampaign = usePatchCampaign();
  const { data: tagsCatalog } = useOrganizationTags({ page_size: 500, tag_type: 'campaigns' });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [search, setSearch] = useState('');
  const [foFilter, setFoFilter] = useState<number>();
  const [activeDragCampaign, setActiveDragCampaign] = useState<Campaign | null>(null);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<number[]>([]);

  useEffect(() => {
    setSelectedCampaignIds([]);
  }, [search, foFilter, tagsFilter]);

  const selectedCampaignSet = useMemo(() => new Set(selectedCampaignIds), [selectedCampaignIds]);

  function toggleCampaignSelect(id: number, checked: boolean) {
    setSelectedCampaignIds((prev) => toggleItemSelection(prev, id, checked));
  }

  function clearCampaignSelection() {
    setSelectedCampaignIds([]);
  }

  const { data, isLoading, isError, error, refetch } = useCampaigns({
    page_size: 500,
    tags: tagsFilter?.length ? tagsFilter.join(',') : undefined,
  });
  const allCampaigns = data?.results || [];

  const filtered = useMemo(() => {
    let list = allCampaigns;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    if (foFilter != null) {
      list = list.filter(c => c.federal_operator === foFilter);
    }
    return list;
  }, [allCampaigns, search, foFilter]);

  const grouped = useMemo(() => {
    const map: Record<BoardColumnKey, Campaign[]> = {
      draft: [],
      organization_list: [],
      active: [],
      paused: [],
      completed: [],
    };
    for (const c of filtered) {
      map[resolveCampaignBoardColumn(c)].push(c);
    }
    return map;
  }, [filtered]);

  const activeCampaignsCount = grouped.active.length + grouped.organization_list.length;

  const foOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of allCampaigns) {
      const id = c.federal_operator;
      if (id == null) continue;
      if (map.has(id)) continue;
      map.set(id, federalOperatorDisplay(c) || (c.federal_operator_name ?? ''));
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b, 'ru'))
      .map(([value, label]) => ({ value, label }));
  }, [allCampaigns]);

  const totalLeads = allCampaigns.reduce((s, c) => s + (c.leads_count || 0), 0);
  const totalDemand = allCampaigns.reduce((s, c) => s + (c.total_demand || 0), 0);

  function handleCampaignDragStart(event: DragStartEvent) {
    const payload = event.active.data.current as CampaignDragPayload | undefined;
    if (!payload?.campaignId) return;
    const found = allCampaigns.find((x) => x.id === payload.campaignId) ?? null;
    setActiveDragCampaign(found);
  }

  function handleCampaignDragEnd(event: DragEndEvent) {
    setActiveDragCampaign(null);
    const { active, over } = event;
    if (!over) return;
    const payload = active.data.current as CampaignDragPayload | undefined;
    if (!payload?.campaignId) return;
    const overId = String(over.id);
    if (!overId.startsWith('board-')) return;
    const targetColumn = overId.slice('board-'.length) as BoardColumnKey;
    if (!BOARD_COLUMNS.some((col) => col.key === targetColumn)) return;
    if (payload.boardColumn === targetColumn) return;

    const newStatus = boardColumnToStatus(targetColumn);
    if (payload.status === newStatus && targetColumn !== 'organization_list' && payload.boardColumn !== 'organization_list') {
      return;
    }

    patchCampaign.mutate(
      { id: payload.campaignId, data: { status: newStatus } },
      {
        onSuccess: () => {
          if (targetColumn === 'organization_list') {
            message.success('Кампания переведена в стадию формирования перечня');
          } else {
            message.success('Статус обновлён');
          }
        },
        onError: () => message.error('Не удалось перенести кампанию'),
      },
    );
  }

  const dragDisabled = patchCampaign.isPending;

  if (isLoading) return <div style={{ textAlign: 'center', paddingTop: 60 }}><Spin size="large" /></div>;

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Не удалось загрузить кампании"
        description={getAxiosErrorMessage(error)}
        action={
          <Button size="small" type="primary" onClick={() => refetch()}>
            Повторить
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <Row gutter={16} className="kanban-stats-row">
        <Col span={6}>
          <Card size="small"><Statistic title="Всего кампаний" value={allCampaigns.length} prefix={<AppstoreOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="В работе"
              value={activeCampaignsCount}
              prefix={<RocketOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="Лидов всего" value={totalLeads} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="Прогноз потребности" value={totalDemand} prefix={<AimOutlined />} suffix="чел." /></Card>
        </Col>
      </Row>

      <Space className="kanban-filters" wrap>
        <Input
          placeholder="Поиск по названию"
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          placeholder="Фед. оператор"
          allowClear
          style={{ width: 220 }}
          value={foFilter}
          onChange={setFoFilter}
          options={foOptions}
        />
        {onTagsFilterChange ? (
          <EntityTagSelect
            availableTags={tagsCatalog?.results ?? []}
            value={tagsFilter ?? []}
            onChange={onTagsFilterChange}
            placeholder="Теги"
            style={{ minWidth: 220 }}
            allowClear
          />
        ) : null}
      </Space>

      {selectedCampaignIds.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={<Typography.Text strong>Выбрано кампаний: {selectedCampaignIds.length}</Typography.Text>}
          action={
            <Button size="small" type="link" onClick={clearCampaignSelection}>
              Снять выбор
            </Button>
          }
        />
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleCampaignDragStart}
        onDragCancel={() => setActiveDragCampaign(null)}
        onDragEnd={handleCampaignDragEnd}
      >
        <div className="kanban-board">
          {BOARD_COLUMNS.map(col => {
            const columnCampaigns = grouped[col.key];
            const columnIds = columnCampaigns.map((campaignItem) => campaignItem.id);
            return (
            <div key={col.key} className={`kanban-column ${col.columnClass}`}>
              <KanbanColumnHeader
                count={columnCampaigns.length}
                columnIds={columnIds}
                selectedIds={selectedCampaignIds}
                onSelectionChange={setSelectedCampaignIds}
                disabled={dragDisabled}
              >
                <h4>{col.label}</h4>
              </KanbanColumnHeader>
              <KanbanDropColumn id={`board-${col.key}`}>
                {columnCampaigns.map(c => (
                  <CampaignBoardCard
                    key={c.id}
                    campaign={c}
                    boardColumn={col.key}
                    navigate={navigate}
                    dragDisabled={dragDisabled}
                    selected={selectedCampaignSet.has(c.id)}
                    onToggleSelect={toggleCampaignSelect}
                  />
                ))}
                {columnCampaigns.length === 0 && (
                  <div style={{ color: '#bbb', textAlign: 'center', padding: 20, fontSize: 13 }}>
                    Нет кампаний
                  </div>
                )}
              </KanbanDropColumn>
            </div>
            );
          })}
        </div>
        <DragOverlay zIndex={1100} dropAnimation={null} style={{ cursor: 'grabbing' }}>
          {activeDragCampaign ? (
            <div className="kanban-card kanban-card--drag-overlay">
              <CampaignCardFace c={activeDragCampaign} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

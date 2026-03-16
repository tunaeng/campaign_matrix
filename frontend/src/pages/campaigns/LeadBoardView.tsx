import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Statistic, Card, Tag, Input, Select, Space, Progress, Tabs, Switch, Typography, Tooltip,
} from 'antd';
import {
  TeamOutlined, CheckCircleOutlined, StopOutlined, SearchOutlined,
  ClockCircleOutlined, CheckOutlined, MessageOutlined, AimOutlined,
} from '@ant-design/icons';
import { useFunnel } from '../../api/hooks';
import type { CampaignDetail, Lead, FunnelStage } from '../../types';
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

export default function LeadBoardView({ campaign }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [managerFilter, setManagerFilter] = useState<number>();
  const [activeQueue, setActiveQueue] = useState<string>('all');
  const [showDetails, setShowDetails] = useState(false);

  const funnelId = campaign.campaign_funnels?.[0]?.funnel;
  const { data: funnelDetail } = useFunnel(funnelId!);

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

      <div className="kanban-board">
        {columns.map(stage => {
          const stageLeads = grouped[stage.id] || [];
          const deadline = getStageDeadline(stage.id);
          const dlClass = deadlineClass(deadline);

          return (
            <div key={stage.id} className={`kanban-column ${stage.is_rejection ? 'stage-rejection' : ''}`}>
              <div className="kanban-column-header">
                <div>
                  <h4>{stage.name}</h4>
                  {deadline && (
                    <span style={{ fontSize: 11 }} className={dlClass}>
                      <ClockCircleOutlined /> {deadline.toLocaleDateString('ru-RU')}
                    </span>
                  )}
                </div>
                <span className="kanban-column-count">{stageLeads.length}</span>
              </div>
              <div className="kanban-cards">
                {stageLeads.map(l => {
                  const pct = l.checklist_progress
                    ? (l.checklist_progress.total > 0 ? Math.round((l.checklist_progress.completed / l.checklist_progress.total) * 100) : 0)
                    : 0;
                  const checklist = l.checklist_summary || [];
                  const lastInt = l.last_interaction;
                  return (
                    <div
                      key={l.id}
                      className="kanban-card"
                      onClick={() => navigate(`/campaigns/${campaign.id}/leads/${l.id}`)}
                    >
                      <div className="kanban-card-title">{l.organization_name}</div>
                      <div className="kanban-card-tags">
                        {l.organization_region && (
                          <Tag style={{ fontSize: 11, margin: 0 }}>{l.organization_region}</Tag>
                        )}
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
                        {l.forecast_demand != null && l.forecast_demand > 0 && (
                          <span className="kanban-card-stat">
                            <AimOutlined /> прогноз: {l.forecast_demand}
                          </span>
                        )}
                      </div>

                      {showDetails && (
                        <div className="kanban-card-details">
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
                          {lastInt && (
                            <div className="kanban-card-interaction">
                              <MessageOutlined style={{ fontSize: 10, color: '#1677ff' }} />
                              <Tooltip title={lastInt.result || undefined}>
                                <span>
                                  {lastInt.contact_person}
                                  {lastInt.date && <> · {new Date(lastInt.date).toLocaleDateString('ru-RU')}</>}
                                  {lastInt.channel && <> · {lastInt.channel}</>}
                                </span>
                              </Tooltip>
                            </div>
                          )}
                          {checklist.length === 0 && !lastInt && (
                            <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>Нет данных</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {stageLeads.length === 0 && (
                  <div style={{ color: '#bbb', textAlign: 'center', padding: 20, fontSize: 13 }}>
                    Нет лидов
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {(grouped[0] || []).length > 0 && (
          <div className="kanban-column">
            <div className="kanban-column-header">
              <h4>Без стадии</h4>
              <span className="kanban-column-count">{grouped[0].length}</span>
            </div>
            <div className="kanban-cards">
              {grouped[0].map(l => (
                <div
                  key={l.id}
                  className="kanban-card"
                  onClick={() => navigate(`/campaigns/${campaign.id}/leads/${l.id}`)}
                >
                  <div className="kanban-card-title">{l.organization_name}</div>
                  {l.organization_region && (
                    <Tag style={{ fontSize: 11 }}>{l.organization_region}</Tag>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

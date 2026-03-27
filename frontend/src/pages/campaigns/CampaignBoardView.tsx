import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Statistic, Card, Tag, Input, Select, Space, Spin, Alert, Button } from 'antd';
import {
  TeamOutlined, RocketOutlined, AppstoreOutlined, AimOutlined, SearchOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useCampaigns } from '../../api/hooks';
import { getAxiosErrorMessage } from '../../api/errorMessage';
import type { Campaign } from '../../types';
import DemandQuotaPreview from '../../components/DemandQuotaPreview';
import './BoardStyles.css';

function formatRuDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU');
}

const STATUS_COLUMNS: { key: Campaign['status']; label: string }[] = [
  { key: 'draft', label: 'Черновик' },
  { key: 'active', label: 'В работе' },
  { key: 'paused', label: 'Приостановлена' },
  { key: 'completed', label: 'Завершена' },
];

export default function CampaignBoardView() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [foFilter, setFoFilter] = useState<string>();

  const { data, isLoading, isError, error, refetch } = useCampaigns({ page_size: 500 });
  const allCampaigns = data?.results || [];

  const filtered = useMemo(() => {
    let list = allCampaigns;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    if (foFilter) {
      list = list.filter(c => c.federal_operator_name === foFilter);
    }
    return list;
  }, [allCampaigns, search, foFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, Campaign[]> = { draft: [], active: [], paused: [], completed: [] };
    for (const c of filtered) {
      if (map[c.status]) map[c.status].push(c);
    }
    return map;
  }, [filtered]);

  const foOptions = useMemo(() => {
    const names = new Set(allCampaigns.map(c => c.federal_operator_name).filter(Boolean) as string[]);
    return Array.from(names).sort().map(n => ({ value: n, label: n }));
  }, [allCampaigns]);

  const totalLeads = allCampaigns.reduce((s, c) => s + (c.leads_count || 0), 0);
  const totalDemand = allCampaigns.reduce((s, c) => s + (c.total_demand || 0), 0);

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
          <Card size="small"><Statistic title="В работе" value={grouped.active.length} prefix={<RocketOutlined />} valueStyle={{ color: '#1677ff' }} /></Card>
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
      </Space>

      <div className="kanban-board">
        {STATUS_COLUMNS.map(col => (
          <div key={col.key} className={`kanban-column status-${col.key}`}>
            <div className="kanban-column-header">
              <h4>{col.label}</h4>
              <span className="kanban-column-count">{grouped[col.key].length}</span>
            </div>
            <div className="kanban-cards">
              {grouped[col.key].map(c => (
                <div
                  key={c.id}
                  className="kanban-card"
                  onClick={() => navigate(`/campaigns/${c.id}`)}
                >
                  <div className="kanban-card-title">{c.name}</div>
                  <div className="kanban-card-tags">
                    {c.federal_operator_name && (
                      <Tag color="geekblue" style={{ fontSize: 11, margin: 0 }}>{c.federal_operator_name}</Tag>
                    )}
                    {(c.funnel_names || []).map((fn, i) => (
                      <Tag key={i} color="blue" style={{ fontSize: 11, margin: 0 }}>{fn}</Tag>
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
                </div>
              ))}
              {grouped[col.key].length === 0 && (
                <div style={{ color: '#bbb', textAlign: 'center', padding: 20, fontSize: 13 }}>
                  Нет кампаний
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

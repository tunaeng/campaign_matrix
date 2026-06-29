import { useMemo } from 'react';
import { Typography, Descriptions, Tag, Space, Divider } from 'antd';
import ResponsiveTable from '../../../components/responsive/ResponsiveTable';
import {
  usePrograms, useFederalOperators, useFunnels, useUsers, useRegions,
} from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';

interface Props {
  data: CampaignFormData;
}

function leadForecastKey(orgId: number, regionId: number | null): string {
  return `${orgId}:${regionId ?? 'null'}`;
}

export default function StepReview({ data }: Props) {
  const { data: programs } = usePrograms();
  const { data: operators } = useFederalOperators();
  const { data: funnels } = useFunnels({ is_active: true });
  const { data: usersData } = useUsers();
  const { data: regionsData } = useRegions({ page_size: 500 });

  const selectedPrograms = (programs?.results || []).filter((p) => data.selectedPrograms.includes(p.id));
  const selectedFunnels = (funnels?.results || []).filter((f) => data.selectedFunnels.includes(f.id));
  const operatorName = (() => {
    const op = (operators?.results || []).find((o) => o.id === data.federal_operator);
    return op ? (op.short_name?.trim() || op.name) : undefined;
  })();
  const usersMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const u of usersData?.results || []) m[u.id] = u.full_name || u.username;
    return m;
  }, [usersData]);
  const programsMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of programs?.results || []) m[p.id] = p.name;
    return m;
  }, [programs]);
  const regionsMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const r of regionsData?.results || []) m[r.id] = r.name;
    return m;
  }, [regionsData]);

  // Group orgs by queue
  const orgsByQueue = useMemo(() => {
    const map: Record<number, typeof data.selectedExternalOrgs> = {};
    for (const q of data.queues) map[q.queue_number] = [];
    for (const org of data.selectedExternalOrgs) {
      const qNum = data.orgQueueAssignments[org.name] || 1;
      if (!map[qNum]) map[qNum] = [];
      map[qNum].push(org);
    }
    return map;
  }, [data.selectedExternalOrgs, data.orgQueueAssignments, data.queues]);

  const getQueueDemand = (queueNumber: number) => {
    const orgs = orgsByQueue[queueNumber] || [];
    if (data.forecastDemandMode === 'total') {
      return data.forecastDemandTotal;
    }
    if (data.forecastDemandMode === 'per_queue') {
      return data.forecastDemandPerQueue[queueNumber] ?? null;
    }
    const sum = orgs.reduce((s, o) => {
      const regionIds = getOrgLeadRegionIds(o);
      if (regionIds.length === 0) {
        return s + (
          data.orgRegionForecast?.[leadForecastKey(o.id, null)] ??
          data.orgDistribution[o.name]?.forecastDemand ??
          0
        );
      }
      return s + regionIds.reduce((acc, regionId) => (
        acc + (
          data.orgRegionForecast?.[leadForecastKey(o.id, regionId)] ??
          data.orgDistribution[o.name]?.forecastDemand ??
          0
        )
      ), 0);
    }, 0);
    return sum || null;
  };
  const getOrgLeadRegionIds = (org: { id: number; region_id?: number | null; federal_company?: boolean }) => {
    const selected = data.federalOrgRegionSelections?.[org.id] || [];
    if (selected.length > 0) return selected;
    return org.region_id != null ? [org.region_id] : [];
  };
  const getOrgLeadCount = (org: { id: number; region_id?: number | null; federal_company?: boolean }) =>
    Math.max(getOrgLeadRegionIds(org).length, 1);
  const getQueueLeadsCount = (queueNumber: number) => {
    const orgs = orgsByQueue[queueNumber] || [];
    return orgs.reduce((sum, org) => sum + getOrgLeadCount(org), 0);
  };
  const totalLeadsCount = useMemo(
    () => data.selectedExternalOrgs.reduce((sum, org) => sum + getOrgLeadCount(org), 0),
    [data.selectedExternalOrgs, data.federalOrgRegionSelections],
  );
  const collectRegionsRows = useMemo(
    () =>
      (data.regionData || []).map((row) => ({
        ...row,
        region_name: regionsMap[row.region_id] || `Регион #${row.region_id}`,
        queue_name:
          data.queues.find((q) => q.queue_number === (row.queue_number ?? 1))?.name
          || `Очередь ${row.queue_number ?? 1}`,
        manager_name: row.manager_id ? (usersMap[row.manager_id] || `#${row.manager_id}`) : null,
        specialist_name: row.specialist_id ? (usersMap[row.specialist_id] || `#${row.specialist_id}`) : null,
      })),
    [data.regionData, data.queues, regionsMap, usersMap],
  );

  const orgColumns = [
    { title: 'Организация', dataIndex: 'name', key: 'name', ellipsis: false },
    { title: 'Регион орг.', dataIndex: 'region', key: 'region', width: 130, ellipsis: true },
    {
      title: 'Регионы лидов',
      key: 'lead_regions',
      width: 260,
      render: (_: any, record: any) => {
        const regionIds = getOrgLeadRegionIds(record);
        if (regionIds.length === 0) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Space size={[4, 4]} wrap>
            {regionIds.map((id) => (
              <Tag key={`${record.id}-${id}`} color="geekblue" style={{ marginRight: 0 }}>
                {regionsMap[id] || `Регион #${id}`}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Лидов',
      key: 'lead_count',
      width: 80,
      render: (_: any, record: any) => getOrgLeadCount(record),
    },
    {
      title: 'Программы',
      key: 'programs',
      width: 420,
      render: (_: any, record: any) => {
        const dist = data.orgDistribution[record.name];
        const ids = dist?.programIds ?? data.selectedPrograms;
        if (!ids.length) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Space size={[4, 4]} wrap>
            {ids.map((id) => programsMap[id] ? (
              <Tag
                key={id}
                style={{
                  fontSize: 12,
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  lineHeight: 1.3,
                  height: 'auto',
                  marginRight: 0,
                  maxWidth: '100%',
                }}
              >
                {programsMap[id]}
              </Tag>
            ) : null)}
          </Space>
        );
      },
    },
    {
      title: 'Менеджер',
      key: 'manager',
      width: 220,
      render: (_: any, record: any) => {
        const dist = data.orgDistribution[record.name];
        const name = dist?.managerId ? usersMap[dist.managerId] : null;
        return name
          ? <Typography.Text>{name}</Typography.Text>
          : <Typography.Text type="secondary">не назначен</Typography.Text>;
      },
    },
    ...(data.profActivityList?.length > 0 ? [{
      title: 'Сфера',
      key: 'profActivity',
      width: 160,
      render: (_: any, record: any) => {
        const dist = data.orgDistribution[record.name];
        return dist?.profActivity
          ? <Tag color="purple">{dist.profActivity}</Tag>
          : <Typography.Text type="secondary">—</Typography.Text>;
      },
    }] : []),
    ...(data.forecastDemandMode === 'per_org' ? [{
      title: 'Прогноз',
      key: 'forecast',
      width: 100,
      render: (_: any, record: any) => {
        const dist = data.orgDistribution[record.name];
        const v = dist?.forecastDemand;
        return v != null ? <Typography.Text>{v}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>;
      },
    }] : []),
  ];

  return (
    <div>
      <Typography.Title level={5}>Обзор кампании перед запуском</Typography.Title>

      <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Название">{data.name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Федеральный оператор">{operatorName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Воронка">
          {selectedFunnels.length > 0
            ? <Space wrap>{selectedFunnels.map((f) => <Tag key={f.id} color="blue">{f.name}</Tag>)}</Space>
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Гипотеза">{data.hypothesis || '—'}</Descriptions.Item>
        <Descriptions.Item label="План лидов">
          <Tag color="blue">{data.hasCollectStage ? data.regionData.length : totalLeadsCount}</Tag>
        </Descriptions.Item>
        {data.hasCollectStage && (
          <Descriptions.Item label="Задание на поиск">
            {data.collectSearchTask?.trim()
              ? data.collectSearchTask
              : <Typography.Text type="secondary">не заполнено</Typography.Text>}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Прогноз потребности">
          {data.forecastDemandMode === 'total' && (
            data.forecastDemandTotal != null
              ? <>{data.forecastDemandTotal} чел. <Tag>общий</Tag></>
              : <Typography.Text type="secondary">не задан</Typography.Text>
          )}
          {data.forecastDemandMode === 'per_queue' && (() => {
            const entries = data.queues
              .map((q) => ({ name: q.name, value: data.forecastDemandPerQueue[q.queue_number] }))
              .filter((e) => e.value != null);
            const total = entries.reduce((s, e) => s + (e.value || 0), 0);
            return entries.length > 0
              ? <Space wrap>{entries.map((e) => <Tag key={e.name}>{e.name}: {e.value}</Tag>)}<Typography.Text type="secondary">итого: {total}</Typography.Text></Space>
              : <Typography.Text type="secondary">не задан</Typography.Text>;
          })()}
          {data.forecastDemandMode === 'per_org' && (() => {
            const total = data.selectedExternalOrgs.reduce((sum, org) => {
              const regionIds = getOrgLeadRegionIds(org);
              if (regionIds.length === 0) {
                return sum + (
                  data.orgRegionForecast?.[leadForecastKey(org.id, null)] ??
                  data.orgDistribution[org.name]?.forecastDemand ??
                  0
                );
              }
              return sum + regionIds.reduce((acc, regionId) => (
                acc + (
                  data.orgRegionForecast?.[leadForecastKey(org.id, regionId)] ??
                  data.orgDistribution[org.name]?.forecastDemand ??
                  0
                )
              ), 0);
            }, 0);
            return total > 0
              ? <>{total} чел. <Tag>по лидам</Tag></>
              : <Typography.Text type="secondary">не задан</Typography.Text>;
          })()}
        </Descriptions.Item>
      </Descriptions>

      <Divider orientation="left">Программы ({selectedPrograms.length})</Divider>
      <Space wrap style={{ marginBottom: 16 }}>
        {selectedPrograms.map((p) => <Tag key={p.id} color="blue">{p.name}</Tag>)}
        {selectedPrograms.length === 0 && <Typography.Text type="secondary">Не выбрано</Typography.Text>}
      </Space>

      {data.hasCollectStage && (
        <>
          <Divider orientation="left">Регионы отбора ({collectRegionsRows.length})</Divider>
          {collectRegionsRows.length === 0 ? (
            <Typography.Text type="secondary">Регионы не выбраны</Typography.Text>
          ) : (
            <ResponsiveTable
              dataSource={collectRegionsRows}
              size="small"
              rowKey="region_id"
              pagination={false}
              columns={[
                { title: 'Регион', dataIndex: 'region_name', key: 'region_name' },
                { title: 'Очередь', dataIndex: 'queue_name', key: 'queue_name' },
                { title: 'Квота', dataIndex: 'demand_quota', key: 'demand_quota', width: 120 },
                {
                  title: 'Задание на поиск',
                  dataIndex: 'search_task',
                  key: 'search_task',
                  ellipsis: true,
                  render: (v: string | undefined) => v?.trim() || <Typography.Text type="secondary">—</Typography.Text>,
                },
                {
                  title: 'Менеджер',
                  dataIndex: 'manager_name',
                  key: 'manager_name',
                  render: (v: string | null) => v || <Typography.Text type="secondary">не назначен</Typography.Text>,
                },
                {
                  title: 'Специалист',
                  dataIndex: 'specialist_name',
                  key: 'specialist_name',
                  render: (v: string | null) => v || <Typography.Text type="secondary">не назначен</Typography.Text>,
                },
              ]}
            />
          )}
        </>
      )}

      {!data.hasCollectStage && data.queues.map((q) => {
        const orgs = orgsByQueue[q.queue_number] || [];
        const queueLeads = getQueueLeadsCount(q.queue_number);
        const qDemand = getQueueDemand(q.queue_number);
        return (
          <div key={q.queue_number}>
            <Divider orientation="left">
              <Space>
                <Typography.Text strong>{q.name}</Typography.Text>
                {q.start_date && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    старт: {new Date(q.start_date).toLocaleDateString('ru-RU')}
                  </Typography.Text>
                )}
                <Tag>{orgs.length} орг.</Tag>
                <Tag color="blue">{queueLeads} лид.</Tag>
                {qDemand != null && <Tag color="orange">прогноз: {qDemand}</Tag>}
              </Space>
            </Divider>
            {orgs.length > 0 ? (
              <ResponsiveTable
                dataSource={orgs}
                columns={orgColumns}
                rowKey="name"
                size="small"
                pagination={false}
                scroll={{ x: 1400 }}
                style={{ marginBottom: 8 }}
              />
            ) : (
              <Typography.Text type="secondary">Нет организаций в этой очереди</Typography.Text>
            )}
          </div>
        );
      })}

      {!data.hasCollectStage && data.selectedExternalOrgs.length === 0 && (
        <>
          <Divider orientation="left">Организации</Divider>
          <Typography.Text type="secondary">Не выбрано</Typography.Text>
        </>
      )}
    </div>
  );
}

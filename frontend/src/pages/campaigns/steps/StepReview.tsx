import { useMemo } from 'react';
import { Typography, Descriptions, Tag, Space, Divider, Table } from 'antd';
import { usePrograms, useFederalOperators, useFunnels, useUsers } from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';

interface Props {
  data: CampaignFormData;
}

export default function StepReview({ data }: Props) {
  const { data: programs } = usePrograms();
  const { data: operators } = useFederalOperators();
  const { data: funnels } = useFunnels({ is_active: true });
  const { data: usersData } = useUsers();

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
    const sum = orgs.reduce((s, o) => s + (data.orgDistribution[o.name]?.forecastDemand || 0), 0);
    return sum || null;
  };

  const orgColumns = [
    { title: 'Организация', dataIndex: 'name', key: 'name', ellipsis: false },
    { title: 'Регион', dataIndex: 'region', key: 'region', width: 140, ellipsis: true },
    {
      title: 'Программы',
      key: 'programs',
      render: (_: any, record: any) => {
        const dist = data.orgDistribution[record.name];
        const ids = dist?.programIds ?? data.selectedPrograms;
        if (!ids.length) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Space size={[4, 4]} wrap>
            {ids.map((id) => programsMap[id] ? (
              <Tag key={id} style={{ fontSize: 12 }}>{programsMap[id]}</Tag>
            ) : null)}
          </Space>
        );
      },
    },
    {
      title: 'Менеджер',
      key: 'manager',
      width: 180,
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
            const total = Object.values(data.orgDistribution).reduce((s, d) => s + (d.forecastDemand || 0), 0);
            return total > 0
              ? <>{total} чел. <Tag>по организациям</Tag></>
              : <Typography.Text type="secondary">не задан</Typography.Text>;
          })()}
        </Descriptions.Item>
      </Descriptions>

      <Divider orientation="left">Программы ({selectedPrograms.length})</Divider>
      <Space wrap style={{ marginBottom: 16 }}>
        {selectedPrograms.map((p) => <Tag key={p.id} color="blue">{p.name}</Tag>)}
        {selectedPrograms.length === 0 && <Typography.Text type="secondary">Не выбрано</Typography.Text>}
      </Space>

      {data.queues.map((q) => {
        const orgs = orgsByQueue[q.queue_number] || [];
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
                {qDemand != null && <Tag color="orange">прогноз: {qDemand}</Tag>}
              </Space>
            </Divider>
            {orgs.length > 0 ? (
              <Table
                dataSource={orgs}
                columns={orgColumns}
                rowKey="name"
                size="small"
                pagination={false}
                style={{ marginBottom: 8 }}
              />
            ) : (
              <Typography.Text type="secondary">Нет организаций в этой очереди</Typography.Text>
            )}
          </div>
        );
      })}

      {data.selectedExternalOrgs.length === 0 && (
        <>
          <Divider orientation="left">Организации</Divider>
          <Typography.Text type="secondary">Не выбрано</Typography.Text>
        </>
      )}
    </div>
  );
}

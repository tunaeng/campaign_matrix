import { useState, useEffect, useMemo } from 'react';
import {
  Typography, Table, Select, Button, Space, Tabs, Tooltip, Popover, Tag, Switch, Divider,
  Radio, InputNumber, Card,
} from 'antd';
import { ReloadOutlined, EditOutlined, UnorderedListOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useMe, useUsers, usePrograms, useFunnels, useExternalProfActivities } from '../../../api/hooks';
import type { CampaignFormData, ForecastDemandMode } from '../CampaignCreatePage';

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
}

const MAX_VISIBLE_TAGS = 3;

function ProgramsCell({
  orgName, programIds, allPrograms, onUpdate, expanded,
}: {
  orgName: string;
  programIds: number[];
  allPrograms: { id: number; name: string }[];
  onUpdate: (orgName: string, ids: number[]) => void;
  expanded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = allPrograms.filter((p) => programIds.includes(p.id));

  const editor = (
    <div style={{ width: 400 }}>
      <Select
        mode="multiple" style={{ width: '100%' }} size="small"
        value={programIds}
        onChange={(ids) => onUpdate(orgName, ids)}
        options={allPrograms.map((p) => ({ value: p.id, label: p.name }))}
        optionFilterProp="label" placeholder="Выберите программы" showSearch
      />
    </div>
  );

  const editBtn = (
    <Popover content={editor} title="Редактировать программы" trigger="click"
      open={open} onOpenChange={setOpen} placement="bottomLeft">
      <Button type="text" size="small" icon={<EditOutlined />}
        style={{ padding: '0 4px', height: 20, lineHeight: '20px', flexShrink: 0 }} />
    </Popover>
  );

  if (expanded) {
    return (
      <div>
        {selected.length === 0
          ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>не выбраны</Typography.Text>
          : selected.map((p) => <div key={p.id} style={{ lineHeight: '22px', fontSize: 13 }}>• {p.name}</div>)
        }
        {editBtn}
      </div>
    );
  }

  const visible = selected.slice(0, MAX_VISIBLE_TAGS);
  const hidden = selected.slice(MAX_VISIBLE_TAGS);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {visible.map((p) => (
        <Tooltip key={p.id} title={p.name}>
          <Tag style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 0 }}>
            {p.name}
          </Tag>
        </Tooltip>
      ))}
      {hidden.length > 0 && (
        <Tooltip title={<ul style={{ margin: 0, paddingLeft: 16 }}>{hidden.map((p) => <li key={p.id}>{p.name}</li>)}</ul>}>
          <Tag color="default" style={{ cursor: 'default', marginRight: 0 }}>+{hidden.length}</Tag>
        </Tooltip>
      )}
      {selected.length === 0 && <Typography.Text type="secondary" style={{ fontSize: 12 }}>не выбраны</Typography.Text>}
      {editBtn}
    </div>
  );
}

export default function StepManagers({ data, onChange }: Props) {
  const { data: me } = useMe();
  const { data: usersData } = useUsers();
  const { data: programsData } = usePrograms({ page_size: 1000 });
  const { data: funnelsData } = useFunnels({ is_active: true });

  const [queueManagerDraft, setQueueManagerDraft] = useState<Record<number, number | undefined>>({});
  // per-ФО prof_activity draft: key = `${queueNum}__${fedDistrict}`
  const [foActivityDraft, setFoActivityDraft] = useState<Record<string, string | undefined>>({});
  const [expandedView, setExpandedView] = useState(false);

  const allPrograms = programsData?.results || [];
  const userOptions = (usersData?.results || []).map((u) => ({
    value: u.id,
    label: u.full_name || u.username,
  }));

  const hasFederalFunnel = data.selectedFunnels.some((fid) => {
    const funnel = funnelsData?.results?.find((f) => f.id === fid);
    return funnel?.name?.toLowerCase().includes('фед');
  });

  const { data: profActivitiesData } = useExternalProfActivities();
  const profActivityOptions = (profActivitiesData || []).map((a) => ({ value: a.name, label: a.name }));

  // Initialize orgDistribution
  useEffect(() => {
    if (!me) return;
    const updated = { ...data.orgDistribution };
    let changed = false;
    for (const org of data.selectedExternalOrgs) {
      if (!updated[org.name]) {
        updated[org.name] = {
          programIds: [...data.selectedPrograms],
          managerId: me.id,
          manuallySetManager: false,
          profActivity: data.profActivityList?.[0] ?? null,
          manuallySetProfActivity: false,
          forecastDemand: null,
        };
        changed = true;
      }
    }
    for (const key of Object.keys(updated)) {
      if (!data.selectedExternalOrgs.find((o) => o.name === key)) {
        delete updated[key];
        changed = true;
      }
    }
    if (changed) onChange({ orgDistribution: updated });
  }, [data.selectedExternalOrgs, me]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group orgs by queue, then by fed_district
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

  const updateOrgForecast = (orgName: string, value: number | null) =>
    onChange({ orgDistribution: { ...data.orgDistribution, [orgName]: { ...data.orgDistribution[orgName], forecastDemand: value } } });

  const updateOrgPrograms = (orgName: string, programIds: number[]) =>
    onChange({ orgDistribution: { ...data.orgDistribution, [orgName]: { ...data.orgDistribution[orgName], programIds } } });

  const updateOrgManager = (orgName: string, managerId: number | null) =>
    onChange({ orgDistribution: { ...data.orgDistribution, [orgName]: { ...data.orgDistribution[orgName], managerId, manuallySetManager: true } } });

  const resetOrgManager = (orgName: string) =>
    onChange({ orgDistribution: { ...data.orgDistribution, [orgName]: { ...data.orgDistribution[orgName], manuallySetManager: false } } });

  const updateOrgProfActivity = (orgName: string, profActivity: string | null) =>
    onChange({ orgDistribution: { ...data.orgDistribution, [orgName]: { ...data.orgDistribution[orgName], profActivity, manuallySetProfActivity: true } } });

  const resetOrgProfActivity = (orgName: string) =>
    onChange({ orgDistribution: { ...data.orgDistribution, [orgName]: { ...data.orgDistribution[orgName], manuallySetProfActivity: false } } });

  const applyQueueManager = (queueNumber: number) => {
    const managerId = queueManagerDraft[queueNumber] ?? null;
    const updated = { ...data.orgDistribution };
    for (const org of (orgsByQueue[queueNumber] || [])) {
      if (!updated[org.name]?.manuallySetManager)
        updated[org.name] = { ...updated[org.name], managerId };
    }
    onChange({ orgDistribution: updated });
    setQueueManagerDraft((prev) => ({ ...prev, [queueNumber]: undefined }));
  };

  const applyFoActivity = (queueNumber: number, fedDistrict: string) => {
    const key = `${queueNumber}__${fedDistrict}`;
    const activity = foActivityDraft[key] ?? null;
    const updated = { ...data.orgDistribution };
    for (const org of (orgsByQueue[queueNumber] || [])) {
      if (org.fed_district === fedDistrict && !updated[org.name]?.manuallySetProfActivity)
        updated[org.name] = { ...updated[org.name], profActivity: activity };
    }
    onChange({ orgDistribution: updated });
    setFoActivityDraft((prev) => ({ ...prev, [key]: undefined }));
  };

  const buildColumns = () => {
    const cols: any[] = [
      { title: 'Организация', dataIndex: 'name', key: 'name', ellipsis: false },
      { title: 'Регион', dataIndex: 'region', key: 'region', width: 140, ellipsis: true },
    ];

    if (hasFederalFunnel) {
      cols.push({
        title: 'Сфера деятельности',
        key: 'profActivity',
        width: 220,
        render: (_: any, record: any) => {
          const dist = data.orgDistribution[record.name];
          return (
            <Space.Compact style={{ width: '100%' }}>
              <Select
                size="small" style={{ flex: 1 }}
                value={dist?.profActivity ?? undefined}
                onChange={(v) => updateOrgProfActivity(record.name, v ?? null)}
                options={profActivityOptions}
                placeholder="Сфера" allowClear
              />
              {dist?.manuallySetProfActivity && (
                <Tooltip title="Сбросить ручное назначение">
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => resetOrgProfActivity(record.name)} />
                </Tooltip>
              )}
            </Space.Compact>
          );
        },
      });
    }

    cols.push({
      title: 'Программы',
      key: 'programs',
      render: (_: any, record: any) => {
        const dist = data.orgDistribution[record.name];
        return (
          <ProgramsCell
            orgName={record.name}
            programIds={dist?.programIds ?? []}
            allPrograms={allPrograms}
            onUpdate={updateOrgPrograms}
            expanded={expandedView}
          />
        );
      },
    });

    cols.push({
      title: 'Менеджер',
      key: 'manager',
      width: 240,
      render: (_: any, record: any) => {
        const dist = data.orgDistribution[record.name];
        return (
          <Space.Compact style={{ width: '100%' }}>
            <Select
              size="small" style={{ flex: 1 }}
              value={dist?.managerId ?? undefined}
              onChange={(v) => updateOrgManager(record.name, v ?? null)}
              options={userOptions} placeholder="Менеджер" allowClear
            />
            {dist?.manuallySetManager && (
              <Tooltip title="Сбросить ручное назначение">
                <Button size="small" icon={<ReloadOutlined />} onClick={() => resetOrgManager(record.name)} />
              </Tooltip>
            )}
          </Space.Compact>
        );
      },
    });

    if (data.forecastDemandMode === 'per_org') {
      cols.push({
        title: 'Прогноз',
        key: 'forecast',
        width: 120,
        render: (_: any, record: any) => {
          const dist = data.orgDistribution[record.name];
          return (
            <InputNumber
              size="small" style={{ width: '100%' }}
              min={0} placeholder="0"
              value={dist?.forecastDemand ?? undefined}
              onChange={(v) => updateOrgForecast(record.name, v)}
            />
          );
        },
      });
    }

    return cols;
  };

  const renderQueueContent = (queueNumber: number) => {
    const orgs = orgsByQueue[queueNumber] || [];

    // Group by fed_district for РОИВ
    const foGroups: Record<string, typeof orgs> = {};
    if (hasFederalFunnel) {
      for (const org of orgs) {
        const fo = org.fed_district || 'Без округа';
        if (!foGroups[fo]) foGroups[fo] = [];
        foGroups[fo].push(org);
      }
    }

    return (
      <div>
        {/* Queue-level manager */}
        <Space style={{ marginBottom: 12 }} wrap align="center">
          <Typography.Text>Менеджер для всей очереди:</Typography.Text>
          <Select style={{ width: 240 }} size="small" placeholder="Выбрать менеджера" allowClear
            value={queueManagerDraft[queueNumber]}
            onChange={(v) => setQueueManagerDraft((prev) => ({ ...prev, [queueNumber]: v }))}
            options={userOptions}
          />
          <Button size="small" type="primary"
            disabled={!queueManagerDraft[queueNumber]}
            onClick={() => applyQueueManager(queueNumber)}
          >
            Применить
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Только к тем, кому не назначено вручную
          </Typography.Text>
        </Space>

        {hasFederalFunnel && Object.keys(foGroups).length > 0 ? (
          Object.entries(foGroups).map(([fo, foOrgs]) => {
            const foKey = `${queueNumber}__${fo}`;
            return (
              <div key={fo}>
                <Divider orientation="left" orientationMargin={0}>
                  <Space size={8}>
                    <Typography.Text strong style={{ fontSize: 13 }}>{fo}</Typography.Text>
                    <Select size="small" style={{ width: 200 }} placeholder="Сфера для всего ФО" allowClear
                      value={foActivityDraft[foKey]}
                      onChange={(v) => setFoActivityDraft((prev) => ({ ...prev, [foKey]: v }))}
                      options={profActivityOptions}
                    />
                    <Button size="small"
                      disabled={!foActivityDraft[foKey]}
                      onClick={() => applyFoActivity(queueNumber, fo)}
                    >
                      Применить к ФО
                    </Button>
                  </Space>
                </Divider>
                <Table dataSource={foOrgs} columns={buildColumns()} rowKey="name"
                  size="small" pagination={false} style={{ marginBottom: 8 }} />
              </div>
            );
          })
        ) : (
          <Table dataSource={orgs} columns={buildColumns()} rowKey="name"
            size="small" pagination={{ pageSize: 20 }} />
        )}
      </div>
    );
  };

  const tabItems = data.queues.map((q) => ({
    key: String(q.queue_number),
    label: `${q.name} (${(orgsByQueue[q.queue_number] || []).length})`,
    children: renderQueueContent(q.queue_number),
  }));

  if (data.selectedExternalOrgs.length === 0) {
    return (
      <div>
        <Typography.Title level={5}>Распределение</Typography.Title>
        <Typography.Text type="secondary">Организации не выбраны. Вернитесь на шаг «Организации».</Typography.Text>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>Распределение</Typography.Title>
        <Space size={8}>
          <AppstoreOutlined style={{ color: expandedView ? '#bfbfbf' : '#1677ff' }} />
          <Switch size="small" checked={expandedView} onChange={setExpandedView} />
          <UnorderedListOutlined style={{ color: expandedView ? '#1677ff' : '#bfbfbf' }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {expandedView ? 'Развёрнутый вид' : 'Компактный вид'}
          </Typography.Text>
        </Space>
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Для каждой организации настройте перечень программ и назначьте менеджера.
        {hasFederalFunnel && ' Для РОИВ — назначьте сферу деятельности по ФО.'}
      </Typography.Text>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Typography.Text strong>Прогноз потребности:</Typography.Text>
            <Radio.Group
              value={data.forecastDemandMode}
              onChange={(e) => onChange({ forecastDemandMode: e.target.value as ForecastDemandMode })}
              size="small"
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: 'Общий', value: 'total' },
                { label: 'По очередям', value: 'per_queue' },
                { label: 'По организациям', value: 'per_org' },
              ]}
            />
          </div>

          {data.forecastDemandMode === 'total' && (
            <Space align="center">
              <Typography.Text type="secondary">Общая цель (чел.):</Typography.Text>
              <InputNumber
                min={0} style={{ width: 160 }}
                placeholder="Введите число"
                value={data.forecastDemandTotal}
                onChange={(v) => onChange({ forecastDemandTotal: v })}
              />
              {data.forecastDemandTotal != null && data.selectedExternalOrgs.length > 0 && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  ≈ {Math.round(data.forecastDemandTotal / data.selectedExternalOrgs.length)} на организацию
                </Typography.Text>
              )}
            </Space>
          )}

          {data.forecastDemandMode === 'per_queue' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {data.queues.map((q) => {
                const count = (orgsByQueue[q.queue_number] || []).length;
                return (
                  <Space key={q.queue_number} align="center">
                    <Typography.Text>{q.name} ({count} орг.):</Typography.Text>
                    <InputNumber
                      min={0} style={{ width: 120 }}
                      placeholder="0"
                      value={data.forecastDemandPerQueue[q.queue_number] ?? undefined}
                      onChange={(v) => onChange({
                        forecastDemandPerQueue: { ...data.forecastDemandPerQueue, [q.queue_number]: v },
                      })}
                    />
                  </Space>
                );
              })}
              {(() => {
                const total = Object.values(data.forecastDemandPerQueue)
                  .reduce((s, v) => s + (v || 0), 0);
                return total > 0 ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12, alignSelf: 'center' }}>
                    Итого: {total}
                  </Typography.Text>
                ) : null;
              })()}
            </div>
          )}

          {data.forecastDemandMode === 'per_org' && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Введите прогноз для каждой организации в столбце «Прогноз» таблицы ниже.
              {(() => {
                const total = Object.values(data.orgDistribution)
                  .reduce((s, d) => s + (d.forecastDemand || 0), 0);
                return total > 0 ? ` Итого: ${total}` : '';
              })()}
            </Typography.Text>
          )}
        </Space>
      </Card>

      <Tabs items={tabItems} />
    </div>
  );
}

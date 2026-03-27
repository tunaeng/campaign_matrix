import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Table, Select, TreeSelect, Space, Typography, Input, Tag, Switch, Button,
  DatePicker, InputNumber, Card, Divider, Tooltip, Popover,
} from 'antd';
import { PlusOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useExternalOrganizations, useExternalFedDistricts,
  useExternalOrgTypes, useExternalProfActivities, useFunnels, useFunnel,
  useDemandMatrix, usePrograms,
} from '../../../api/hooks';

/** Добавить N рабочих дней к дате (пропуская сб/вс). */
function addBusinessDays(startDate: string, days: number): string {
  let date = dayjs(startDate);
  let remaining = days;
  while (remaining > 0) {
    date = date.add(1, 'day');
    if (date.day() !== 0 && date.day() !== 6) remaining--;
  }
  return date.format('DD.MM.YYYY');
}
import type { CampaignFormData } from '../CampaignCreatePage';
import type { ExternalOrganization } from '../../../types';

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
}

export default function StepOrganizations({ data, onChange }: Props) {
  const [orgType, setOrgType] = useState<string>();
  // encoded as "district:ИМЯ" or "region:ИМЯ", multiple
  const [regionSelection, setRegionSelection] = useState<string[]>([]);
  // multiple prof activities (tags mode)
  const [profActivityList, setProfActivityList] = useState<string[]>(data.profActivityList || []);
  const [federalOnly, setFederalOnly] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: fedDistricts } = useExternalFedDistricts();
  const { data: orgTypes } = useExternalOrgTypes();
  const { data: profActivitiesData } = useExternalProfActivities();
  const { data: funnelsData } = useFunnels({ is_active: true });
  const { data: demandMatrix } = useDemandMatrix(
    data.federal_operator ? { federal_operator: data.federal_operator } : undefined,
  );
  const { data: programsData } = usePrograms({ page_size: 1000 });

  const selectedFunnelId = data.selectedFunnels[0];
  const { data: funnelDetail } = useFunnel(selectedFunnelId || 0);

  const hasFederalFunnel = data.selectedFunnels.some(fid => {
    const funnel = funnelsData?.results?.find(f => f.id === fid);
    return funnel?.name?.toLowerCase().includes('фед');
  });

  // Track which funnel we've already initialized to avoid repeated writes
  const initializedFunnelRef = useRef<number | null>(null);

  useEffect(() => {
    if (!funnelDetail?.stages?.length) return;
    if (initializedFunnelRef.current === funnelDetail.id) return;
    initializedFunnelRef.current = funnelDetail.id;

    const stages = [...funnelDetail.stages].filter(s => !s.is_rejection).sort((a, b) => a.order - b.order);
    const today = dayjs().format('YYYY-MM-DD');

    const newQueues = data.queues.map((q, idx) => {
      const existingIds = new Set(q.stage_deadlines.map(d => d.funnel_stage_id));
      const missingStages = stages.filter(s => !existingIds.has(s.id));
      const newDeadlines = missingStages.length > 0
        ? [
            ...q.stage_deadlines,
            ...missingStages.map(s => ({ funnel_stage_id: s.id, deadline_days: s.deadline_days })),
          ]
        : q.stage_deadlines;
      const newStartDate = (idx === 0 && !q.start_date) ? today : q.start_date;
      return { ...q, stage_deadlines: newDeadlines, start_date: newStartDate };
    });
    onChange({ queues: newQueues });
  }, [funnelDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build treeData for TreeSelect: districts → regions
  const regionTreeData = useMemo(() =>
    (fedDistricts || []).map(d => ({
      title: d.name,
      value: `district:${d.name}`,
      selectable: true,
      children: (d.region || []).map(r => ({
        title: r.name,
        value: `region:${r.name}`,
      })),
    })),
    [fedDistricts],
  );

  const searchParams = useMemo(() => {
    if (!searchTriggered) return undefined;
    const params: Record<string, any> = {};
    if (orgType) params.type = orgType;
    if (regionSelection.length > 0) {
      const districts = regionSelection
        .filter(v => v.startsWith('district:'))
        .map(v => v.slice('district:'.length));
      const regions = regionSelection
        .filter(v => v.startsWith('region:'))
        .map(v => v.slice('region:'.length));
      if (districts.length) params.fed_districts = districts.join(',');
      if (regions.length) params.regions = regions.join(',');
    }
    if (profActivityList.length > 0) params.prof_activities = profActivityList.join(',');
    if (federalOnly || hasFederalFunnel) params.federal = 'true';
    return params;
  }, [searchTriggered, orgType, regionSelection, profActivityList, federalOnly, hasFederalFunnel]);

  // Sync profActivityList changes up to formData
  const prevProfRef = useRef(profActivityList);
  useEffect(() => {
    if (prevProfRef.current !== profActivityList) {
      prevProfRef.current = profActivityList;
      onChange({ profActivityList });
    }
  }, [profActivityList]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: externalOrgs, isLoading: loadingOrgs } = useExternalOrganizations(searchParams);

  const orgList = externalOrgs || [];

  const selectedOrgNames = new Set(data.selectedExternalOrgs.map(o => o.name));

  // region name -> region id mapping from demand matrix
  const regionNameToId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of (demandMatrix?.regions || [])) {
      map[r.name] = r.id;
    }
    return map;
  }, [demandMatrix]);

  // programId -> profession_id lookup
  const programProfession = useMemo(() => {
    const map: Record<number, number> = {};
    for (const p of (programsData?.results || [])) {
      map[p.id] = p.profession;
    }
    return map;
  }, [programsData]);

  // Returns list of selected program IDs that are NOT demanded in the given region name
  const getNotDemandedPrograms = (regionName: string): number[] => {
    const regionId = regionNameToId[regionName];
    if (!regionId || !demandMatrix) return [];
    return data.selectedPrograms.filter((pid) => {
      const profId = programProfession[pid];
      if (!profId) return false;
      const prof = demandMatrix.professions.find((pr) => pr.profession_id === profId);
      if (!prof) return true; // profession not in matrix → not demanded
      return prof.regions[String(regionId)] !== true;
    });
  };

  const handleSelectOrg = (keys: React.Key[], rows: ExternalOrganization[]) => {
    const existing = new Map(data.selectedExternalOrgs.map(o => [o.name, o]));
    for (const row of rows) {
      if (!existing.has(row.name)) {
        existing.set(row.name, row);
      }
    }
    const deselectedNames = orgList
      .filter(o => !keys.includes(o.name))
      .map(o => o.name);
    for (const name of deselectedNames) {
      existing.delete(name);
    }
    onChange({ selectedExternalOrgs: Array.from(existing.values()) });
  };

  const sortedStages = useMemo(
    () => funnelDetail?.stages
      ? [...funnelDetail.stages].filter(s => !s.is_rejection).sort((a, b) => a.order - b.order)
      : [],
    [funnelDetail],
  );

  const addQueue = () => {
    const nextNum = data.queues.length + 1;
    onChange({
      queues: [
        ...data.queues,
        {
          queue_number: nextNum,
          name: `Очередь ${nextNum}`,
          start_date: null,
          end_date: null,
          stage_deadlines: [],
        },
      ],
    });
  };

  const removeQueue = (idx: number) => {
    if (data.queues.length <= 1) return;
    const newQueues = data.queues.filter((_, i) => i !== idx);
    onChange({ queues: newQueues });
  };

  const updateQueue = (idx: number, field: string, value: any) => {
    const newQueues = [...data.queues];
    newQueues[idx] = { ...newQueues[idx], [field]: value };
    onChange({ queues: newQueues });
  };

  const updateStageDeadline = (queueIdx: number, stageId: number, days: number | null) => {
    const newQueues = [...data.queues];
    const queue = { ...newQueues[queueIdx] };
    const deadlines = [...(queue.stage_deadlines || [])];
    const existingIdx = deadlines.findIndex(d => d.funnel_stage_id === stageId);
    if (existingIdx >= 0) {
      deadlines[existingIdx] = { ...deadlines[existingIdx], deadline_days: days || 0 };
    } else {
      deadlines.push({ funnel_stage_id: stageId, deadline_days: days || 0 });
    }
    queue.stage_deadlines = deadlines;
    newQueues[queueIdx] = queue;
    onChange({ queues: newQueues });
  };

  const updateOrgQueue = (orgName: string, queueNum: number) => {
    const assignments = { ...(data.orgQueueAssignments || {}) };
    assignments[orgName] = queueNum;
    onChange({ orgQueueAssignments: assignments });
  };

  const columns = [
    {
      title: 'Организация',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      width: 150,
    },
    {
      title: 'Регион',
      dataIndex: 'region',
      key: 'region',
      width: 180,
      render: (v: string) => v || '—',
    },
    {
      title: 'Округ',
      dataIndex: 'fed_district',
      key: 'fed_district',
      width: 180,
    },
    {
      title: 'Фед.',
      dataIndex: 'federal_company',
      key: 'federal',
      width: 60,
      align: 'center' as const,
      render: (v: boolean) => v ? <Tag color="blue">Да</Tag> : null,
    },
    {
      title: 'Прогр.',
      key: 'demand_org',
      width: 90,
      render: (_: any, record: ExternalOrganization) => {
        if (!demandMatrix || data.selectedPrograms.length === 0) return null;
        const notDemanded = getNotDemandedPrograms(record.region);
        if (notDemanded.length === 0) {
          return <Tooltip title="Все выбранные программы востребованы"><Tag color="success" style={{ marginRight: 0 }}>✓</Tag></Tooltip>;
        }
        return (
          <Tooltip title={`${notDemanded.length} из ${data.selectedPrograms.length} программ не востребованы в регионе`}>
            <Tag color="warning" style={{ marginRight: 0 }}>{notDemanded.length}/{data.selectedPrograms.length}</Tag>
          </Tooltip>
        );
      },
    },
  ];

  const selectedColumns = [
    {
      title: 'Организация',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Регион',
      dataIndex: 'region',
      key: 'region',
      width: 150,
    },
    {
      title: 'Востребованность',
      key: 'demand',
      width: 160,
      render: (_: any, record: ExternalOrganization) => {
        if (!demandMatrix || data.selectedPrograms.length === 0) return null;
        const notDemanded = getNotDemandedPrograms(record.region);
        if (notDemanded.length === 0) {
          return (
            <Tag color="success">Все программы</Tag>
          );
        }
        const notDemandedNames = notDemanded
          .map((pid) => programsData?.results?.find((p) => p.id === pid)?.name)
          .filter(Boolean);
        return (
          <Popover
            title={<span><WarningOutlined style={{ color: '#faad14' }} /> Не востребованы в регионе</span>}
            content={
              <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 200, overflow: 'auto', minWidth: 200 }}>
                {notDemandedNames.map((n) => <li key={n}>{n}</li>)}
              </ul>
            }
          >
            <Tag color="warning" icon={<WarningOutlined />} style={{ cursor: 'pointer' }}>
              {notDemanded.length} не востребов.
            </Tag>
          </Popover>
        );
      },
    },
    {
      title: 'Очередь',
      key: 'queue',
      width: 140,
      render: (_: any, record: ExternalOrganization) => (
        <Select
          size="small"
          value={data.orgQueueAssignments?.[record.name] || 1}
          onChange={(v) => updateOrgQueue(record.name, v)}
          style={{ width: 120 }}
          options={data.queues.map(q => ({
            value: q.queue_number,
            label: q.name || `Очередь ${q.queue_number}`,
          }))}
        />
      ),
    },
    {
      title: '',
      key: 'remove',
      width: 50,
      render: (_: any, record: ExternalOrganization) => (
        <Button
          type="text" danger size="small" icon={<DeleteOutlined />}
          onClick={() => {
            onChange({
              selectedExternalOrgs: data.selectedExternalOrgs.filter(o => o.name !== record.name),
            });
          }}
        />
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={5}>Организации и очереди</Typography.Title>

      <Card size="small" style={{ marginBottom: 16 }} title="Поиск организаций">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <Select
            placeholder="Тип организации"
            allowClear
            style={{ width: 200 }}
            value={orgType}
            onChange={setOrgType}
            options={(orgTypes || []).map(t => ({ value: t.name, label: t.name }))}
          />
          <TreeSelect
            placeholder="Фильтр по округам/регионам"
            allowClear
            showSearch
            treeCheckable
            showCheckedStrategy={TreeSelect.SHOW_PARENT}
            style={{ width: 320 }}
            value={regionSelection}
            onChange={setRegionSelection}
            treeData={regionTreeData}
            treeNodeFilterProp="title"
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            maxTagCount={2}
            maxTagPlaceholder={(omitted) => `+${omitted.length} ещё`}
            treeLine
          />
          <Select
            mode="multiple"
            placeholder={hasFederalFunnel ? 'Сфера деятельности (мин. 1)' : 'Сфера деятельности'}
            value={profActivityList}
            onChange={setProfActivityList}
            style={{ minWidth: 220, maxWidth: 360 }}
            allowClear
            options={(profActivitiesData || []).map(a => ({ value: a.name, label: a.name }))}
            status={hasFederalFunnel && profActivityList.length === 0 ? 'warning' : undefined}
          />
          <Button type="primary" onClick={() => setSearchTriggered(true)}>
            Найти организации
          </Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Switch checked={federalOnly} onChange={setFederalOnly} size="small" />
          <Typography.Text>Только федеральные</Typography.Text>
        </div>

        {searchTriggered && (
          <Table
            dataSource={orgList}
            columns={columns}
            rowKey="name"
            loading={loadingOrgs}
            size="small"
            style={{ marginTop: 12 }}
            pagination={{ pageSize: 10, showTotal: (t) => `Всего: ${t}` }}
            rowSelection={{
              selectedRowKeys: Array.from(selectedOrgNames),
              onChange: handleSelectOrg,
            }}
          />
        )}
      </Card>

      {data.selectedExternalOrgs.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }} title={`Выбранные организации (${data.selectedExternalOrgs.length})`}>
          <Table
            dataSource={data.selectedExternalOrgs}
            columns={selectedColumns}
            rowKey="name"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      <Card size="small" title="Очереди">
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Для каждой очереди задайте дату старта и количество рабочих дней на каждый этап воронки. По умолчанию все организации попадают в Очередь 1.
        </Typography.Text>
        {data.queues.map((q, qIdx) => (
          <Card
            key={qIdx}
            size="small"
            style={{ marginBottom: 8 }}
            title={
              <Space>
                <Input
                  size="small"
                  value={q.name}
                  onChange={(e) => updateQueue(qIdx, 'name', e.target.value)}
                  style={{ width: 160 }}
                />
                <DatePicker
                  size="small"
                  value={q.start_date ? dayjs(q.start_date) : null}
                  onChange={(d) => updateQueue(qIdx, 'start_date', d ? d.format('YYYY-MM-DD') : null)}
                  format="DD.MM.YYYY"
                  placeholder="Дата старта"
                />
                {data.queues.length > 1 && (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeQueue(qIdx)} />
                )}
              </Space>
            }
          >
            {sortedStages.length > 0 ? (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #f0f0f0' }}>
                  <Typography.Text type="secondary" style={{ width: 220, fontSize: 12 }}>Этап</Typography.Text>
                  <Typography.Text type="secondary" style={{ width: 130, fontSize: 12 }}>Рабочих дней</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Дата дедлайна</Typography.Text>
                </div>
                {sortedStages.map(stage => {
                  const override = q.stage_deadlines.find(d => d.funnel_stage_id === stage.id);
                  const days = override?.deadline_days ?? stage.deadline_days;
                  const deadlineDate = q.start_date ? addBusinessDays(q.start_date, days) : null;
                  return (
                    <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Typography.Text style={{ width: 220 }}>{stage.name}</Typography.Text>
                      <InputNumber
                        size="small"
                        min={0}
                        value={days}
                        onChange={(v) => updateStageDeadline(qIdx, stage.id, v)}
                        addonAfter="р.д."
                        style={{ width: 130 }}
                      />
                      {deadlineDate
                        ? <Typography.Text type="secondary">{deadlineDate}</Typography.Text>
                        : <Typography.Text type="secondary">— укажите дату старта</Typography.Text>
                      }
                    </div>
                  );
                })}
              </div>
            ) : null}
          </Card>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={addQueue} style={{ marginTop: 8 }}>
          Добавить очередь
        </Button>
      </Card>
    </div>
  );
}

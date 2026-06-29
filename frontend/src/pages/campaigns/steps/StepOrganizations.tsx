import { useState, useMemo } from 'react';
import {
  Select, TreeSelect, Space, Typography, Input, Tag, Button,
  Card, Tooltip, Popover,
} from 'antd';
import ResponsiveTable from '../../../components/responsive/ResponsiveTable';
import { DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import {
  useOrganizations, useFederalDistricts, useRegions,
  useOrganizationTags, useFunnels, useDemandMatrix, usePrograms,
} from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';
import type { ExternalOrganization } from '../../../types';
import QueueScheduleSection, { remapQueueNumber } from './QueueScheduleSection';

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
}

export default function StepOrganizations({ data, onChange }: Props) {
  const ORG_TYPE_OPTIONS = [
    { value: 'roiv', label: 'РОИВ' },
    { value: 'federal', label: 'Федеральная' },
    { value: 'municipal', label: 'Муниципальная' },
    { value: 'private', label: 'Коммерческая' },
    { value: 'company_branch', label: 'Подразделение (без ИНН)' },
    { value: 'other', label: 'Другое' },
  ];
  const [orgType, setOrgType] = useState<string>();
  const [searchText, setSearchText] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  // encoded as "district:ID" or "region:ID", multiple
  const [regionSelection, setRegionSelection] = useState<string[]>([]);
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: fedDistrictsData } = useFederalDistricts();
  const { data: regionsData } = useRegions({ page_size: 500 });
  const { data: tagsData } = useOrganizationTags({ page_size: 500, tag_type: 'organizations' });
  const { data: funnelsData } = useFunnels({ is_active: true });
  const { data: demandMatrix } = useDemandMatrix(
    data.federal_operator ? { federal_operator: data.federal_operator } : undefined,
  );
  const { data: programsData } = usePrograms({ page_size: 1000 });

  const hasFederalFunnel = data.selectedFunnels.some(fid => {
    const funnel = funnelsData?.results?.find(f => f.id === fid);
    return funnel?.name?.toLowerCase().includes('фед');
  });

  // Build treeData for TreeSelect: districts → regions
  const regionTreeData = useMemo(() => {
    const districts = fedDistrictsData?.results || [];
    const regions = regionsData?.results || [];
    return districts.map((d) => ({
      title: d.name,
      value: `district:${d.id}`,
      selectable: true,
      children: regions
        .filter((r) => r.federal_district === d.id)
        .map((r) => ({
          title: r.name,
          value: `region:${r.id}`,
        })),
    }));
  }, [fedDistrictsData, regionsData]);

  const searchParams = useMemo(() => {
    if (!searchTriggered) return undefined;
    const params: Record<string, any> = {};
    if (searchText.trim()) params.search = searchText.trim();
    if (orgType) params.org_type = orgType;
    if (tagIds.length) params.tags = tagIds.join(',');
    if (regionSelection.length > 0) {
      const districtIds = regionSelection
        .filter(v => v.startsWith('district:'))
        .map(v => Number(v.slice('district:'.length)))
        .filter((id) => Number.isFinite(id));
      const selectedRegionIds = regionSelection
        .filter(v => v.startsWith('region:'))
        .map(v => Number(v.slice('region:'.length)))
        .filter((id) => Number.isFinite(id));
      const districtRegionIds = (regionsData?.results || [])
        .filter((r) => districtIds.includes(r.federal_district))
        .map((r) => r.id);
      const mergedRegionIds = Array.from(new Set([...selectedRegionIds, ...districtRegionIds]));
      if (mergedRegionIds.length) params.region_ids = mergedRegionIds.join(',');
    }
    if (hasFederalFunnel) params.org_type = 'roiv';
    return params;
  }, [searchTriggered, searchText, orgType, tagIds, regionSelection, regionsData, hasFederalFunnel]);

  const { data: organizationsData, isLoading: loadingOrgs } = useOrganizations(searchParams);
  const districtNameById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const d of fedDistrictsData?.results || []) map[d.id] = d.name;
    return map;
  }, [fedDistrictsData]);
  const orgList = useMemo(() => {
    return (organizationsData?.results || []).map((o) => {
      const regionObj = (regionsData?.results || []).find((r) => r.id === o.region);
      const fedDistrictName = regionObj ? districtNameById[regionObj.federal_district] || '' : '';
      return {
        id: o.id,
        name: o.name,
        full_name: o.name,
        type: o.org_type_display || '',
        region: o.region_name || '',
        region_id: o.region ?? null,
        federal_company: o.org_type === 'federal',
        fed_district: fedDistrictName,
        prof_activity: '',
        projects: [],
        is_active: true,
        is_our_side: o.is_our_side,
        inn: o.inn,
        created_at: o.created_at || '',
        updated_at: o.updated_at || '',
      };
    });
  }, [organizationsData, regionsData, districtNameById]);
  const regionOptions = useMemo(
    () => (regionsData?.results || []).map((r) => ({ value: r.id, label: r.name })),
    [regionsData],
  );

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

  const handleSelectOrg = (keys: React.Key[], rows: any[]) => {
    const existing = new Map(data.selectedExternalOrgs.map(o => [o.name, o]));
    for (const row of rows) {
      if (!existing.has(row.name)) {
        existing.set(row.name, row);
      }
    }
    const deselectedNames = orgList
      .filter(o => !keys.includes(o.id))
      .map(o => o.name);
    for (const name of deselectedNames) {
      existing.delete(name);
    }
    const selectedExternalOrgs = Array.from(existing.values());
    const selectedOrgIds = new Set(selectedExternalOrgs.map((o) => o.id));
    const federalOrgRegionSelections = { ...(data.federalOrgRegionSelections || {}) };
    for (const org of selectedExternalOrgs) {
      if (
        org.federal_company
        && federalOrgRegionSelections[org.id] == null
        && org.region_id != null
      ) {
        federalOrgRegionSelections[org.id] = [org.region_id];
      }
    }
    for (const orgId of Object.keys(federalOrgRegionSelections)) {
      if (!selectedOrgIds.has(Number(orgId))) {
        delete federalOrgRegionSelections[Number(orgId)];
      }
    }
    onChange({ selectedExternalOrgs, federalOrgRegionSelections });
  };

  const updateFederalOrgRegions = (orgId: number, regionIds: number[]) => {
    const uniqueIds = Array.from(new Set(regionIds));
    onChange({
      federalOrgRegionSelections: {
        ...(data.federalOrgRegionSelections || {}),
        [orgId]: uniqueIds,
      },
    });
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
      title: 'Регионы лидов',
      key: 'lead_regions',
      width: 320,
      render: (_: any, record: ExternalOrganization & { id: number; region_id?: number | null }) => {
        const configured = data.federalOrgRegionSelections?.[record.id] || [];
        const showPicker = record.federal_company || configured.length > 1;
        if (!showPicker) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Select
            mode="multiple"
            size="small"
            style={{ width: '100%' }}
            placeholder="Выберите регионы для лидов"
            value={configured}
            onChange={(v) => updateFederalOrgRegions(record.id, v)}
            options={regionOptions}
            maxTagCount={2}
            optionFilterProp="label"
          />
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
            const federalOrgRegionSelections = { ...(data.federalOrgRegionSelections || {}) };
            delete federalOrgRegionSelections[(record as any).id];
            onChange({
              selectedExternalOrgs: data.selectedExternalOrgs.filter(o => o.name !== record.name),
              federalOrgRegionSelections,
            });
          }}
        />
      ),
    },
  ];
  const federalWithoutRegionsCount = data.selectedExternalOrgs.filter(
    (o) => o.federal_company && (data.federalOrgRegionSelections?.[o.id]?.length ?? 0) === 0,
  ).length;

  const orgSearchContent = (
    <>
          <Card size="small" style={{ marginBottom: 16 }} title="Поиск организаций">
            <div className="filter-bar" style={{ marginBottom: 8 }}>
              <Select
                placeholder="Тип организации"
                allowClear
                style={{ width: 200 }}
                value={orgType}
                onChange={setOrgType}
                options={ORG_TYPE_OPTIONS}
                disabled={hasFederalFunnel}
              />
              <Input
                placeholder="Поиск по названию / ИНН"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 260 }}
                allowClear
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
                allowClear
                placeholder="Теги"
                style={{ width: 260 }}
                value={tagIds}
                onChange={(v) => setTagIds(v)}
                options={(tagsData?.results || []).map((t) => ({ value: t.id, label: t.name }))}
              />
              <Button type="primary" onClick={() => setSearchTriggered(true)}>
                Найти организации
              </Button>
            </div>

            {searchTriggered && (
              <ResponsiveTable
                dataSource={orgList}
                columns={columns}
                rowKey="id"
                loading={loadingOrgs}
                size="small"
                style={{ marginTop: 12 }}
                pagination={{ pageSize: 10, showTotal: (t) => `Всего: ${t}` }}
                rowSelection={{
                  selectedRowKeys: data.selectedExternalOrgs.map((o: any) => o.id).filter(Boolean),
                  onChange: handleSelectOrg,
                }}
              />
            )}
          </Card>

          {data.selectedExternalOrgs.length > 0 && (
            <Card size="small" style={{ marginBottom: 16 }} title={`Выбранные организации (${data.selectedExternalOrgs.length})`}>
              {federalWithoutRegionsCount > 0 && (
                <Typography.Text type="danger" style={{ display: 'block', marginBottom: 8 }}>
                  Выберите минимум один регион для всех федеральных организаций.
                </Typography.Text>
              )}
              <ResponsiveTable
                dataSource={data.selectedExternalOrgs}
                columns={selectedColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10 }}
              />
            </Card>
          )}
    </>
  );
  return (
    <div>
      <Typography.Title level={5}>Организации и очереди</Typography.Title>

      {orgSearchContent}

      <QueueScheduleSection
        data={data}
        onChange={onChange}
        onQueueRemoved={(removedQueueNumber) => {
          const assignments = { ...(data.orgQueueAssignments || {}) };
          for (const [orgName, qNum] of Object.entries(assignments)) {
            assignments[orgName] = remapQueueNumber(qNum, removedQueueNumber);
          }
          onChange({ orgQueueAssignments: assignments });
        }}
      />
    </div>
  );
}

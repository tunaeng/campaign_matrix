import { useState, useMemo } from 'react';
import { Table, Select, Space, Typography, Tag, Button, Input, Switch } from 'antd';
import { useRegions, useFederalDistricts, usePrograms, useDemandMatrix } from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';
import type { Region } from '../../../types';

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
}

export default function StepRegions({ data, onChange }: Props) {
  const { data: districts } = useFederalDistricts();
  const { data: regions } = useRegions();
  const { data: programs } = usePrograms();
  const [districtFilter, setDistrictFilter] = useState<number>();
  const [demandedOnly, setDemandedOnly] = useState(false);

  const selectedProfessionIds = useMemo(() => {
    if (!programs?.results) return [];
    return programs.results
      .filter((p) => data.selectedPrograms.includes(p.id))
      .map((p) => p.profession)
      .filter((v, i, a) => a.indexOf(v) === i);
  }, [programs, data.selectedPrograms]);

  const { data: demandMatrix } = useDemandMatrix({
    profession_ids: selectedProfessionIds.length > 0
      ? selectedProfessionIds.join(',')
      : undefined,
    demanded_only: false,
  });

  const allRegions = regions?.results || [];

  const demandCountByRegion = useMemo(() => {
    if (!demandMatrix) return {};
    const counts: Record<number, number> = {};
    for (const prof of demandMatrix.professions) {
      for (const [regionId, isDemanded] of Object.entries(prof.regions)) {
        if (isDemanded) {
          counts[Number(regionId)] = (counts[Number(regionId)] || 0) + 1;
        }
      }
    }
    return counts;
  }, [demandMatrix]);

  const filteredRegions = allRegions.filter((r) => {
    if (districtFilter && r.federal_district !== districtFilter) return false;
    if (demandedOnly && !(demandCountByRegion[r.id] > 0)) return false;
    return true;
  });

  const selectedRegionIds = data.regionData.map((rd) => rd.region_id);

  const handleSelectionChange = (keys: number[]) => {
    const existingMap = new Map(data.regionData.map((rd) => [rd.region_id, rd]));
    const newRegionData = keys.map((regionId) => {
      if (existingMap.has(regionId)) return existingMap.get(regionId)!;
      return { region_id: regionId, queue_number: 1, manager_id: null };
    });
    onChange({ regionData: newRegionData });
  };

  const updateRegionQueue = (regionId: number, queueNumber: number) => {
    onChange({
      regionData: data.regionData.map((rd) =>
        rd.region_id === regionId ? { ...rd, queue_number: queueNumber } : rd
      ),
    });
  };

  const handleSelectDistrict = (districtId: number) => {
    const districtRegionIds = allRegions
      .filter((r) => r.federal_district === districtId)
      .map((r) => r.id);
    const currentIds = new Set(selectedRegionIds);
    districtRegionIds.forEach((id) => currentIds.add(id));
    handleSelectionChange(Array.from(currentIds));
  };

  const demandLabel = selectedProfessionIds.length > 0
    ? `Востреб. (${selectedProfessionIds.length} проф.)`
    : 'Востреб. профессий';

  const columns = [
    {
      title: 'Регион',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Округ',
      dataIndex: 'federal_district_name',
      key: 'district',
      width: 220,
    },
    {
      title: demandLabel,
      key: 'demand',
      width: 160,
      align: 'center' as const,
      render: (_: any, record: Region) => {
        const count = demandCountByRegion[record.id] || 0;
        return (
          <Tag color={count > 50 ? 'green' : count > 20 ? 'blue' : count > 0 ? 'default' : 'red'}>
            {count}
          </Tag>
        );
      },
    },
    {
      title: 'Очередь',
      key: 'queue',
      width: 120,
      render: (_: any, record: Region) => {
        const rd = data.regionData.find((r) => r.region_id === record.id);
        if (!rd) return '—';
        return (
          <Select
            size="small"
            value={rd.queue_number}
            onChange={(v) => updateRegionQueue(record.id, v)}
            style={{ width: 90 }}
            options={data.queues.map((q) => ({
              value: q.queue_number,
              label: q.name,
            }))}
          />
        );
      },
    },
  ];

  return (
    <div>
      <Typography.Title level={5}>Выбор регионов и распределение по очередям</Typography.Title>

      {data.selectedPrograms.length > 0 && (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Востребованность показана для {selectedProfessionIds.length} профессий из выбранных программ.
        </Typography.Text>
      )}

      <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
        <Typography.Text strong>Очереди:</Typography.Text>
        <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
          {data.queues.map((q, idx) => (
            <Space key={idx}>
              <Input
                size="small"
                value={q.name}
                onChange={(e) => {
                  const newQueues = [...data.queues];
                  newQueues[idx] = { ...q, name: e.target.value };
                  onChange({ queues: newQueues });
                }}
                style={{ width: 160 }}
              />
              {idx === data.queues.length - 1 && (
                <Button
                  size="small"
                  type="dashed"
                  onClick={() =>
                    onChange({
                      queues: [
                        ...data.queues,
                        {
                          queue_number: data.queues.length + 1,
                          name: `Очередь ${data.queues.length + 1}`,
                          start_date: null,
                          end_date: null,
                        },
                      ],
                    })
                  }
                >
                  + Добавить очередь
                </Button>
              )}
            </Space>
          ))}
        </Space>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="Фильтр по округу"
          allowClear
          style={{ width: 280 }}
          value={districtFilter}
          onChange={setDistrictFilter}
          options={(districts?.results || []).map((d) => ({
            value: d.id,
            label: d.name,
          }))}
        />
        {districtFilter && (
          <Button size="small" onClick={() => handleSelectDistrict(districtFilter)}>
            Выбрать весь округ
          </Button>
        )}
        <Space>
          <Switch checked={demandedOnly} onChange={setDemandedOnly} size="small" />
          <Typography.Text>Только с востребованными профессиями</Typography.Text>
        </Space>
      </Space>

      <Table
        dataSource={filteredRegions}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20, showTotal: (t) => `Всего: ${t}` }}
        rowSelection={{
          selectedRowKeys: selectedRegionIds,
          onChange: (keys) => handleSelectionChange(keys as number[]),
        }}
      />

      {selectedRegionIds.length > 0 && (
        <Typography.Text style={{ marginTop: 8, display: 'block' }}>
          Выбрано регионов: <strong>{selectedRegionIds.length}</strong>
        </Typography.Text>
      )}
    </div>
  );
}

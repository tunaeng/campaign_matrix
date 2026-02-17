import { Typography, Table, Select, Tabs, Space } from 'antd';
import { useUsers, usePrograms, useRegions, useOrganizations } from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
}

export default function StepManagers({ data, onChange }: Props) {
  const { data: users } = useUsers();
  const { data: programs } = usePrograms();
  const { data: regions } = useRegions();
  const { data: orgs } = useOrganizations();

  const userOptions = (users?.results || []).map((u) => ({
    value: u.id,
    label: u.full_name || u.username,
  }));

  const findAssignment = (level: string, targetId: number) => {
    return data.managerAssignments.find(
      (a) => a.level === level && a.target_id === targetId
    );
  };

  const setAssignment = (level: string, targetId: number, managerId: number | null) => {
    const filtered = data.managerAssignments.filter(
      (a) => !(a.level === level && a.target_id === targetId)
    );
    if (managerId) {
      filtered.push({ level, target_id: targetId, manager_id: managerId });
    }
    onChange({ managerAssignments: filtered });
  };

  const programList = (programs?.results || []).filter((p) =>
    data.selectedPrograms.includes(p.id)
  );
  const regionList = (regions?.results || []).filter((r) =>
    data.regionData.some((rd) => rd.region_id === r.id)
  );
  const orgList = (orgs?.results || []).filter((o) =>
    data.selectedOrganizations.includes(o.id)
  );

  const programColumns = [
    { title: 'Программа', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: 'Менеджер',
      key: 'manager',
      width: 250,
      render: (_: any, record: any) => (
        <Select
          placeholder="Назначить"
          allowClear
          size="small"
          style={{ width: '100%' }}
          value={findAssignment('program', record.id)?.manager_id}
          onChange={(v) => setAssignment('program', record.id, v)}
          options={userOptions}
        />
      ),
    },
  ];

  const regionColumns = [
    { title: 'Регион', dataIndex: 'name', key: 'name' },
    { title: 'Округ', dataIndex: 'federal_district_name', key: 'district', width: 200 },
    {
      title: 'Менеджер',
      key: 'manager',
      width: 250,
      render: (_: any, record: any) => (
        <Select
          placeholder="Назначить"
          allowClear
          size="small"
          style={{ width: '100%' }}
          value={findAssignment('region', record.id)?.manager_id}
          onChange={(v) => setAssignment('region', record.id, v)}
          options={userOptions}
        />
      ),
    },
  ];

  const orgColumns = [
    { title: 'Организация', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Регион', dataIndex: 'region_name', key: 'region', width: 180 },
    {
      title: 'Менеджер',
      key: 'manager',
      width: 250,
      render: (_: any, record: any) => (
        <Select
          placeholder="Назначить"
          allowClear
          size="small"
          style={{ width: '100%' }}
          value={findAssignment('organization', record.id)?.manager_id}
          onChange={(v) => setAssignment('organization', record.id, v)}
          options={userOptions}
        />
      ),
    },
  ];

  const tabItems = [
    {
      key: 'programs',
      label: `По программам (${programList.length})`,
      children: (
        <Table
          dataSource={programList}
          columns={programColumns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      ),
    },
    {
      key: 'regions',
      label: `По регионам (${regionList.length})`,
      children: (
        <Table
          dataSource={regionList}
          columns={regionColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 15 }}
        />
      ),
    },
    {
      key: 'organizations',
      label: `По организациям (${orgList.length})`,
      children: (
        <Table
          dataSource={orgList}
          columns={orgColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 15 }}
        />
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={5}>Назначение менеджеров по коммуникации</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Назначьте ответственных менеджеров на уровне программ, регионов или конкретных организаций.
        Можно назначить одного менеджера на всё или разных на каждый уровень.
      </Typography.Text>

      <Tabs items={tabItems} />
    </div>
  );
}

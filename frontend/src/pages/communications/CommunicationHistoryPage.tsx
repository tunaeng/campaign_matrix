import { useMemo, useState } from 'react';
import { DatePicker, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCommunicationHistory, useOrganizations, useProjects } from '../../api/hooks';
import ResponsiveTable from '../../components/responsive/ResponsiveTable';

export default function CommunicationHistoryPage() {
  const [project, setProject] = useState<number | undefined>();
  const [organization, setOrganization] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const params = useMemo(
    () => ({
      project,
      organization,
      date_from: dateRange?.[0]?.format('YYYY-MM-DD'),
      date_to: dateRange?.[1]?.format('YYYY-MM-DD'),
    }),
    [project, organization, dateRange],
  );

  const { data, isLoading } = useCommunicationHistory(params);
  const { data: projectsData } = useProjects({ page_size: 500 });
  const { data: organizationsData } = useOrganizations({ page_size: 500 });

  return (
    <div>
      <Typography.Title level={4}>История коммуникаций</Typography.Title>
      <Space className="filter-bar" style={{ marginBottom: 12 }} wrap>
        <Select
          allowClear
          placeholder="Проект"
          style={{ width: 220 }}
          value={project}
          onChange={(v) => setProject(v)}
          options={(projectsData?.results || []).map((p) => ({
            value: p.id,
            label: `${p.name} (${p.year})`,
          }))}
        />
        <Select
          allowClear
          placeholder="Организация"
          style={{ width: 280 }}
          value={organization}
          onChange={(v) => setOrganization(v)}
          options={(organizationsData?.results || []).map((o) => ({
            value: o.id,
            label: o.inn
              ? `${o.name} (ИНН ${o.inn})`
              : o.org_type === 'company_branch' && o.parent_organization_short_name
                ? `${o.name} (${o.parent_organization_short_name})`
                : `${o.name} (подразделение)`,
          }))}
          showSearch
          optionFilterProp="label"
        />
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(v) => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
        />
      </Space>

      <ResponsiveTable
        rowKey="id"
        loading={isLoading}
        dataSource={data || []}
        pagination={{ pageSize: 30 }}
        columns={[
          {
            title: 'Дата',
            dataIndex: 'occurred_at',
            key: 'occurred_at',
            width: 120,
            render: (v: string) => (v ? dayjs(v).format('DD.MM.YYYY') : '—'),
          },
          { title: 'Тип', dataIndex: 'type_display', key: 'type_display', width: 160 },
          { title: 'Контрагент', dataIndex: 'organization_name', key: 'organization_name' },
          { title: 'От нашей организации', dataIndex: 'acting_organization_name', key: 'acting_organization_name' },
          { title: 'Проект', dataIndex: 'project_name', key: 'project_name', width: 180 },
          { title: 'Менеджер', dataIndex: 'manager_name', key: 'manager_name', width: 160 },
          { title: 'Описание', dataIndex: 'summary', key: 'summary' },
        ]}
      />
    </div>
  );
}

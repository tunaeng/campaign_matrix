import { Typography, Descriptions, Tag, Space, Divider } from 'antd';
import { usePrograms, useRegions, useOrganizations, useFederalOperators } from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';

interface Props {
  data: CampaignFormData;
}

export default function StepReview({ data }: Props) {
  const { data: programs } = usePrograms();
  const { data: regions } = useRegions();
  const { data: orgs } = useOrganizations();
  const { data: operators } = useFederalOperators();

  const selectedPrograms = (programs?.results || []).filter((p) =>
    data.selectedPrograms.includes(p.id)
  );
  const selectedRegions = (regions?.results || []).filter((r) =>
    data.regionData.some((rd) => rd.region_id === r.id)
  );
  const selectedOrgs = (orgs?.results || []).filter((o) =>
    data.selectedOrganizations.includes(o.id)
  );
  const operatorName = (operators?.results || []).find(
    (op) => op.id === data.federal_operator
  )?.name;

  return (
    <div>
      <Typography.Title level={5}>Обзор кампании перед созданием</Typography.Title>

      <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Название">{data.name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Федеральный оператор">{operatorName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Прогноз потребности">
          {data.forecast_demand ? `${data.forecast_demand} чел.` : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Дедлайн">{data.deadline || '—'}</Descriptions.Item>
        <Descriptions.Item label="Гипотеза">{data.hypothesis || '—'}</Descriptions.Item>
      </Descriptions>

      <Divider orientation="left">
        Программы ({selectedPrograms.length})
      </Divider>
      <Space wrap>
        {selectedPrograms.map((p) => (
          <Tag key={p.id} color="blue">{p.name}</Tag>
        ))}
        {selectedPrograms.length === 0 && <Typography.Text type="secondary">Не выбрано</Typography.Text>}
      </Space>

      <Divider orientation="left">
        Очереди ({data.queues.length})
      </Divider>
      <Space wrap>
        {data.queues.map((q) => (
          <Tag key={q.queue_number}>{q.name}</Tag>
        ))}
      </Space>

      <Divider orientation="left">
        Регионы ({selectedRegions.length})
      </Divider>
      <Space wrap>
        {selectedRegions.map((r) => {
          const rd = data.regionData.find((d) => d.region_id === r.id);
          const queue = data.queues.find((q) => q.queue_number === rd?.queue_number);
          return (
            <Tag key={r.id}>
              {r.name} {queue ? `(${queue.name})` : ''}
            </Tag>
          );
        })}
        {selectedRegions.length === 0 && <Typography.Text type="secondary">Не выбрано</Typography.Text>}
      </Space>

      <Divider orientation="left">
        Заказчики ({selectedOrgs.length})
      </Divider>
      <Space wrap>
        {selectedOrgs.slice(0, 20).map((o) => (
          <Tag key={o.id}>{o.short_name || o.name}</Tag>
        ))}
        {selectedOrgs.length > 20 && (
          <Tag>...и ещё {selectedOrgs.length - 20}</Tag>
        )}
        {selectedOrgs.length === 0 && <Typography.Text type="secondary">Не выбрано</Typography.Text>}
      </Space>

      <Divider orientation="left">
        Менеджеры ({data.managerAssignments.length} назначений)
      </Divider>
      {data.managerAssignments.length === 0 ? (
        <Typography.Text type="secondary">Менеджеры не назначены</Typography.Text>
      ) : (
        <Typography.Text>
          Назначено {data.managerAssignments.length} менеджеров по коммуникации
        </Typography.Text>
      )}
    </div>
  );
}

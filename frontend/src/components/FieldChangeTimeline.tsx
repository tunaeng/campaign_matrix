import { Empty, List, Space, Tag, Typography } from 'antd';
import type { EntityFieldChange } from '../types';

interface FieldChangeTimelineProps {
  items?: EntityFieldChange[];
  loading?: boolean;
  emptyText?: string;
}

export default function FieldChangeTimeline({ items, loading, emptyText }: FieldChangeTimelineProps) {
  const rows = items || [];
  if (!loading && rows.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText || 'Изменений пока нет'} />;
  }

  return (
    <List
      loading={loading}
      dataSource={rows}
      renderItem={(row) => (
        <List.Item>
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Space wrap size={[8, 4]}>
              <Typography.Text strong>{row.field_name}</Typography.Text>
              <Tag>{row.source_display}</Tag>
              <Typography.Text type="secondary">
                {new Date(row.changed_at).toLocaleString('ru-RU')}
              </Typography.Text>
            </Space>
            <Typography.Text>
              <Typography.Text delete>{row.old_value || '—'}</Typography.Text>
              {' -> '}
              <Typography.Text>{row.new_value || '—'}</Typography.Text>
            </Typography.Text>
            <Typography.Text type="secondary">
              {row.changed_by_name ? `Изменил: ${row.changed_by_name}` : 'Изменено системой'}
            </Typography.Text>
          </Space>
        </List.Item>
      )}
    />
  );
}

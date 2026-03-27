import { Modal, List, Spin, Typography, Empty, Space } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { useLeadInteractions } from '../api/hooks';
import type { LeadInteraction } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  leadId: number | null;
  organizationName?: string;
};

function sortByDateDesc(items: LeadInteraction[]) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.date || a.created_at).getTime();
    const tb = new Date(b.date || b.created_at).getTime();
    return tb - ta;
  });
}

export default function LeadInteractionsHistoryModal({
  open,
  onClose,
  leadId,
  organizationName,
}: Props) {
  const { data, isLoading, isError } = useLeadInteractions(leadId ?? undefined, {
    enabled: open && !!leadId,
  });

  const sorted = useMemo(() => (data ? sortByDateDesc(data) : []), [data]);

  return (
    <Modal
      title={
        <span>
          <MessageOutlined style={{ marginRight: 8 }} />
          Взаимодействия
          {organizationName && (
            <Typography.Text type="secondary" style={{ fontWeight: 'normal', marginLeft: 8 }}>
              {organizationName}
            </Typography.Text>
          )}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnClose
    >
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      )}
      {!isLoading && isError && (
        <Typography.Text type="danger">Не удалось загрузить историю</Typography.Text>
      )}
      {!isLoading && !isError && sorted.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет взаимодействий" />
      )}
      {!isLoading && !isError && sorted.length > 0 && (
        <List
          size="small"
          dataSource={sorted}
          renderItem={(item) => (
            <List.Item key={item.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <Space wrap size={[8, 4]} style={{ marginBottom: 4 }}>
                <Typography.Text strong>
                  {item.date
                    ? new Date(item.date).toLocaleString('ru-RU')
                    : new Date(item.created_at).toLocaleString('ru-RU')}
                </Typography.Text>
                <Typography.Text type="secondary">{item.channel_display || item.channel}</Typography.Text>
              </Space>
              {(item.contact_person || item.contact_full_name) && (
                <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                  {item.contact_full_name || item.contact_person}
                  {item.contact_position ? ` · ${item.contact_position}` : ''}
                </Typography.Text>
              )}
              <Typography.Paragraph style={{ marginBottom: 0, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                {item.result?.trim() ? item.result : '—'}
              </Typography.Paragraph>
              {item.created_by_name && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {item.created_by_name}
                </Typography.Text>
              )}
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}

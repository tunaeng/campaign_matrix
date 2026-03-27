import { Modal, Descriptions, Button, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { LeadPrimaryContactBrief } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  contact: LeadPrimaryContactBrief | null;
  /** Подпись в шапке (например, воронка лида) */
  subtitle?: string | null;
  /** Ссылка «Открыть лид» */
  leadLink?: { campaignId: string | number; leadId: string | number } | null;
};

export default function ContactPreviewModal({
  open,
  onClose,
  contact,
  subtitle,
  leadLink,
}: Props) {
  const navigate = useNavigate();

  return (
    <Modal
      title={
        <Space direction="vertical" size={0}>
          <span>Основной контакт</span>
          {subtitle && (
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
              {subtitle}
            </Typography.Text>
          )}
        </Space>
      }
      open={open && !!contact}
      onCancel={onClose}
      footer={
        leadLink ? (
          <Button
            type="primary"
            onClick={() => {
              navigate(`/campaigns/${leadLink.campaignId}/leads/${leadLink.leadId}`);
              onClose();
            }}
          >
            Открыть лид
          </Button>
        ) : null
      }
      width={520}
      destroyOnClose
    >
      {contact && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Тип">{contact.type_display}</Descriptions.Item>
          {contact.type === 'department' ? (
            <Descriptions.Item label="Подразделение">
              {contact.department_name || '—'}
            </Descriptions.Item>
          ) : (
            <Descriptions.Item label="ФИО">{contact.full_name || '—'}</Descriptions.Item>
          )}
          {contact.type === 'person' && (
            <Descriptions.Item label="Должность">{contact.position || '—'}</Descriptions.Item>
          )}
          <Descriptions.Item label="Телефон">{contact.phone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{contact.email || '—'}</Descriptions.Item>
          <Descriptions.Item label="Мессенджер">{contact.messenger || '—'}</Descriptions.Item>
          {!!contact.comment?.trim() && (
            <Descriptions.Item label="Комментарий">{contact.comment}</Descriptions.Item>
          )}
        </Descriptions>
      )}
    </Modal>
  );
}

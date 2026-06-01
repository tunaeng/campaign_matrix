import { Alert, Button, Popconfirm, Space, Spin, Typography } from 'antd';
import { DeleteOutlined, NodeIndexOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

interface BulkSelectionToolbarProps {
  count: number;
  entityLabel: string;
  busy?: boolean;
  onMoveStage?: () => void;
  moveStageLabel?: string;
  onDelete?: () => void;
  deleteConfirmTitle?: string;
  onClearSelection: () => void;
  extraActions?: ReactNode;
}

export default function BulkSelectionToolbar({
  count,
  entityLabel,
  busy = false,
  onMoveStage,
  moveStageLabel = 'Стадия…',
  onDelete,
  deleteConfirmTitle,
  onClearSelection,
  extraActions,
}: BulkSelectionToolbarProps) {
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message={(
        <Space wrap align="center">
          {busy && <Spin size="small" />}
          <Typography.Text strong>
            Выбрано {entityLabel}: {count}
          </Typography.Text>
        </Space>
      )}
      action={(
        <Space wrap>
          {extraActions}
          {onMoveStage && (
            <Button
              size="small"
              icon={<NodeIndexOutlined />}
              disabled={busy}
              onClick={onMoveStage}
            >
              {moveStageLabel}
            </Button>
          )}
          {onDelete && (
            <Popconfirm
              title={deleteConfirmTitle || `Удалить выбранные (${count})?`}
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true, disabled: busy }}
              disabled={busy}
              onConfirm={onDelete}
            >
              <Button size="small" danger icon={<DeleteOutlined />} disabled={busy}>
                Удалить
              </Button>
            </Popconfirm>
          )}
          <Button size="small" type="link" disabled={busy} onClick={onClearSelection}>
            Снять выбор
          </Button>
        </Space>
      )}
    />
  );
}

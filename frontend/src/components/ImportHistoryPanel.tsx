import { App, Button, Empty, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useImportBatches, useRollbackImportBatch } from '../api/hooks';
import type { ImportBatch } from '../types';

interface ImportHistoryPanelProps {
  entityType: 'organizations' | 'contacts';
  title?: string;
}

export default function ImportHistoryPanel({ entityType, title }: ImportHistoryPanelProps) {
  const { message } = App.useApp();
  const { data, isLoading, isError, refetch } = useImportBatches({ entity_type: entityType, page_size: 20 });
  const rollback = useRollbackImportBatch();

  const rows = data?.results || [];

  const columns: ColumnsType<ImportBatch> = [
    {
      title: 'Файл',
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: true,
    },
    {
      title: 'Дата',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      width: 150,
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Результат',
      key: 'stats',
      width: 220,
      render: (_, row) => (
        <Space size={4} wrap>
          <Tag color="green">+{row.created_count}</Tag>
          <Tag color="blue">~{row.updated_count}</Tag>
          {row.skipped_count > 0 && <Tag>пропущено {row.skipped_count}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Статус',
      key: 'status',
      width: 130,
      render: (_, row) =>
        row.status === 'rolled_back' ? (
          <Tag color="default">Откат выполнен</Tag>
        ) : (
          <Tag color="success">Загружен</Tag>
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, row) =>
        row.can_rollback ? (
          <Popconfirm
            title="Откатить импорт?"
            description="Созданные записи будут удалены, изменённые — восстановлены к состоянию до загрузки файла."
            okText="Откатить"
            cancelText="Отмена"
            okButtonProps={{ danger: true, loading: rollback.isPending }}
            onConfirm={async () => {
              try {
                const result = await rollback.mutateAsync(row.id);
                const errCount = result.errors?.length || 0;
                if (errCount > 0) {
                  message.warning(
                    `Откат частично выполнен: удалено ${result.deleted}, восстановлено ${result.reverted}. Ошибок: ${errCount}.`,
                  );
                } else {
                  message.success(
                    `Откат выполнен: удалено ${result.deleted}, восстановлено ${result.reverted}.`,
                  );
                }
                refetch();
              } catch {
                message.error('Не удалось откатить импорт');
              }
            }}
          >
            <Button size="small" danger disabled={rollback.isPending}>
              Откатить
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  if (!rows.length && !isLoading) {
    return (
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
          {title || 'Загруженные файлы'}
        </Typography.Title>
        {isError ? (
          <Typography.Text type="danger">
            Не удалось загрузить историю импорта.{' '}
            <Button type="link" size="small" onClick={() => refetch()} style={{ padding: 0 }}>
              Повторить
            </Button>
          </Typography.Text>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Пока нет загруженных файлов. После импорта Excel здесь появится список с возможностью отката."
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
        {title || 'Загруженные файлы'}
      </Typography.Title>
      <Table
        rowKey="id"
        size="small"
        loading={isLoading || rollback.isPending}
        dataSource={rows}
        columns={columns}
        pagination={false}
      />
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Button, Space, Select, Typography, Input, Popconfirm, App, Segmented, Alert, Modal, Form } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useCampaigns, useDeleteCampaign, useOrganizationTags, useBulkUpdateCampaigns, useBulkDeleteCampaigns } from '../../api/hooks';
import { getAxiosErrorMessage } from '../../api/errorMessage';
import type { Campaign } from '../../types';
import CampaignBoardView from './CampaignBoardView';
import EntityTagSelect, { renderTagChips } from '../../components/EntityTagSelect';
import BulkSelectionToolbar from '../../components/BulkSelectionToolbar';

const CAMPAIGN_STAGE_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'organization_list', label: 'Формирование перечня организаций' },
  { value: 'active', label: 'В работе' },
  { value: 'paused', label: 'Приостановлена' },
  { value: 'completed', label: 'Завершена' },
];

const statusColors: Record<string, string> = {
  draft: 'default',
  active: 'processing',
  paused: 'warning',
  completed: 'success',
};

function formatCampaignDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU');
}

export default function CampaignListPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const deleteCampaign = useDeleteCampaign();
  const bulkUpdateCampaigns = useBulkUpdateCampaigns();
  const bulkDeleteCampaigns = useBulkDeleteCampaigns();
  const { data: tagsCatalog } = useOrganizationTags({ page_size: 500, tag_type: 'campaigns' });
  const [viewMode, setViewMode] = useState<'table' | 'board'>('board');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState<string>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [bulkStageModalOpen, setBulkStageModalOpen] = useState(false);
  const [bulkStageForm] = Form.useForm();
  const { data, isLoading, isError, error, refetch } = useCampaigns({
    status: statusFilter,
    search: search || undefined,
    tags: tagFilter.length ? tagFilter.join(',') : undefined,
    page,
    ordering,
  });

  const bulkBusy = bulkUpdateCampaigns.isPending || bulkDeleteCampaigns.isPending;

  async function runBulkMoveStage() {
    if (!selectedRowKeys.length) return;
    try {
      const vals = await bulkStageForm.validateFields();
      const result = await bulkUpdateCampaigns.mutateAsync({
        ids: selectedRowKeys,
        board_column: vals.board_column,
      });
      const skipped = result.skipped?.length || 0;
      if (skipped > 0) {
        message.warning(`Обновлено: ${result.updated}. Пропущено: ${skipped}.`);
      } else {
        message.success(`Обновлено кампаний: ${result.updated ?? 0}`);
      }
      setBulkStageModalOpen(false);
      bulkStageForm.resetFields();
      setSelectedRowKeys([]);
    } catch {
      message.error('Не удалось перенести кампании');
    }
  }

  async function runBulkDelete() {
    if (!selectedRowKeys.length) return;
    try {
      const result = await bulkDeleteCampaigns.mutateAsync(selectedRowKeys);
      message.success(`Удалено кампаний: ${result.deleted ?? 0}`);
      setSelectedRowKeys([]);
    } catch {
      message.error('Не удалось удалить кампании');
    }
  }

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (name: string, record: Campaign) => (
        <a onClick={() => navigate(`/campaigns/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string, record: Campaign) => (
        <Tag color={statusColors[status]}>{record.status_display}</Tag>
      ),
    },
    {
      title: 'ФО',
      key: 'operator',
      width: 200,
      render: (_: unknown, record: Campaign) => {
        const label =
          record.federal_operator_short_name?.trim() || record.federal_operator_name;
        if (!label) return '—';
        return (
          <span
            title={record.federal_operator_name || undefined}
            style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
          >
            {label}
          </span>
        );
      },
    },
    {
      title: 'Программ',
      dataIndex: 'programs_count',
      key: 'programs',
      width: 100,
      align: 'center' as const,
    },
    {
      title: 'Регионов',
      dataIndex: 'regions_count',
      key: 'regions',
      width: 100,
      align: 'center' as const,
    },
    {
      title: 'Лидов',
      dataIndex: 'leads_count',
      key: 'leads',
      width: 90,
      align: 'center' as const,
      render: (v: number | undefined) => v ?? '—',
    },
    {
      title: 'Потребность',
      dataIndex: 'total_demand',
      key: 'demand',
      width: 120,
      align: 'center' as const,
      render: (v: number) => v || '—',
    },
    {
      title: 'Воронки',
      dataIndex: 'funnel_names',
      key: 'funnels',
      width: 200,
      render: (v: string[] | undefined) =>
        v && v.length > 0
          ? v.map((n, i) => <Tag key={i} color="blue" style={{ marginBottom: 2 }}>{n}</Tag>)
          : '—',
    },
    {
      title: 'Теги',
      key: 'tags',
      width: 220,
      render: (_: unknown, record: Campaign) =>
        renderTagChips(record.tag_names, tagsCatalog?.results, record.tags) || '—',
    },
    {
      title: 'Даты',
      key: 'dates',
      width: 200,
      render: (_: unknown, record: Campaign) => (
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <div>Создана: {formatCampaignDate(record.created_at)}</div>
          {record.queue_periods && record.queue_periods.length > 0
            ? record.queue_periods.map((qp) => (
                <div key={qp.queue_number}>
                  {record.queue_periods!.length > 1
                    ? <span style={{ color: '#8c8c8c' }}>{qp.name}: </span>
                    : <span style={{ color: '#8c8c8c' }}>Период: </span>
                  }
                  {formatCampaignDate(qp.start_date)} — {formatCampaignDate(qp.end_date)}
                </div>
              ))
            : (record.queue_period_start || record.queue_period_end) && (
                <div>
                  Период: {formatCampaignDate(record.queue_period_start)} — {formatCampaignDate(record.queue_period_end)}
                </div>
              )
          }
        </div>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'center' as const,
      render: (_: any, record: Campaign) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => { e.stopPropagation(); navigate(`/campaigns/${record.id}/edit`); }}
            title="Редактировать"
          />
          <Popconfirm
            title="Удалить кампанию?"
            description={`«${record.name}» будет удалена без возможности восстановления.`}
            okText="Удалить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={async (e) => {
              e?.stopPropagation();
              try {
                await deleteCampaign.mutateAsync(record.id);
                message.success('Кампания удалена');
              } catch {
                message.error('Ошибка при удалении');
              }
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
              title="Удалить"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleTableChange = (pagination: any, _filters: any, sorter: any) => {
    setPage(pagination.current || 1);
    if (sorter.field && sorter.order) {
      const dir = sorter.order === 'descend' ? '-' : '';
      setOrdering(`${dir}${sorter.field}`);
    } else {
      setOrdering(undefined);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Кампании по сбору потребности
        </Typography.Title>
        <Space>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'table' | 'board')}
            options={[
              { value: 'table', icon: <UnorderedListOutlined />, label: 'Таблица' },
              { value: 'board', icon: <AppstoreOutlined />, label: 'Доска' },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/campaigns/new')}
          >
            Создать кампанию
          </Button>
        </Space>
      </div>

      {viewMode === 'board' ? (
        <CampaignBoardView tagsFilter={tagFilter} onTagsFilterChange={setTagFilter} />
      ) : (
      <Card>
        {isError && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="Не удалось загрузить кампании"
            description={getAxiosErrorMessage(error)}
            action={
              <Button size="small" type="primary" onClick={() => refetch()}>
                Повторить
              </Button>
            }
          />
        )}
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="Поиск по названию"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="Статус"
            allowClear
            style={{ width: 180 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[
              { value: 'draft', label: 'Черновик' },
              { value: 'active', label: 'В работе' },
              { value: 'paused', label: 'Приостановлена' },
              { value: 'completed', label: 'Завершена' },
            ]}
          />
          <EntityTagSelect
            availableTags={tagsCatalog?.results ?? []}
            value={tagFilter}
            onChange={(v) => { setTagFilter(v); setPage(1); }}
            placeholder="Теги"
            style={{ minWidth: 220 }}
          />
        </Space>

        {selectedRowKeys.length > 0 && (
          <BulkSelectionToolbar
            count={selectedRowKeys.length}
            entityLabel="кампаний"
            busy={bulkBusy}
            onMoveStage={() => setBulkStageModalOpen(true)}
            moveStageLabel="Стадия…"
            onDelete={runBulkDelete}
            deleteConfirmTitle={`Удалить ${selectedRowKeys.length} кампаний?`}
            onClearSelection={() => setSelectedRowKeys([])}
          />
        )}

        <Table
          dataSource={data?.results || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          onChange={handleTableChange}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => {
              if (bulkBusy) return;
              setSelectedRowKeys(keys as number[]);
            },
            getCheckboxProps: () => ({ disabled: bulkBusy }),
            selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
          }}
          pagination={{
            current: page,
            total: data?.count,
            pageSize: 50,
            showTotal: (total) => `Всего: ${total}`,
          }}
          size="middle"
        />

        <Modal
          title="Перенести кампании на стадию"
          open={bulkStageModalOpen}
          onCancel={() => { setBulkStageModalOpen(false); bulkStageForm.resetFields(); }}
          onOk={runBulkMoveStage}
          confirmLoading={bulkUpdateCampaigns.isPending}
          destroyOnClose
        >
          <Form form={bulkStageForm} layout="vertical">
            <Form.Item name="board_column" label="Стадия" rules={[{ required: true, message: 'Выберите стадию' }]}>
              <Select options={CAMPAIGN_STAGE_OPTIONS} placeholder="Стадия" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
      )}
    </div>
  );
}

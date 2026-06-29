import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Input,
  App,
  Tabs,
  Select,
  Switch,
  Drawer,
  InputNumber,
  Popconfirm,
  Divider,
  Empty,
  Collapse,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import ResponsiveTable from '../../components/responsive/ResponsiveTable';
import {
  useFunnels,
  useCreateFunnel,
  useDeleteFunnel,
  useOrganizationTags,
  useSubfunnelTemplates,
  useCreateSubfunnelTemplate,
  usePatchSubfunnelTemplate,
  useDeleteSubfunnelTemplate,
  useRoles,
  useUsers,
  useTaskTemplateStages,
  useCreateTaskTemplateStage,
  usePatchTaskTemplateStage,
  useDeleteTaskTemplateStage,
  useSubfunnelTemplateItems,
  useCreateSubfunnelTemplateItem,
  usePatchSubfunnelTemplateItem,
  useDeleteSubfunnelTemplateItem,
} from '../../api/hooks';
import type { Funnel, SubfunnelTemplate, SubfunnelTemplateItem } from '../../types';
import { getAxiosErrorMessage } from '../../api/errorMessage';
import EntityTagSelect, { renderTagChips } from '../../components/EntityTagSelect';
import { isCanonicalTaskFunnel } from '../../utils/taskFunnelCatalog';
import { TASK_STATUS_META, TASK_WORKFLOW_STATUSES, type TaskWorkflowStatus } from '../../utils/taskStatusLabels';

export default function FunnelListPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'tasks' ? 'tasks' : 'campaign';
  const { data: tagsCatalog } = useOrganizationTags({ page_size: 500, tag_type: 'funnels' });
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const { data: funnels, isLoading } = useFunnels({ tags: tagFilter.length ? tagFilter.join(',') : undefined });
  const createFunnel = useCreateFunnel();
  const deleteFunnel = useDeleteFunnel();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: subfunnelTemplates, isLoading: isTaskTemplatesLoading } = useSubfunnelTemplates({ page_size: 200 });
  const { data: rolesData } = useRoles({ is_active: true, page_size: 200 });
  const { data: usersData } = useUsers();
  const createTaskTemplate = useCreateSubfunnelTemplate();
  const patchTaskTemplate = usePatchSubfunnelTemplate();
  const deleteTaskTemplate = useDeleteSubfunnelTemplate();
  const [taskTemplateModalOpen, setTaskTemplateModalOpen] = useState(false);
  const [taskTemplateForm] = Form.useForm();
  const [selectedTaskTemplate, setSelectedTaskTemplate] = useState<SubfunnelTemplate | null>(null);
  const [taskTemplateEditorOpen, setTaskTemplateEditorOpen] = useState(false);
  const { data: taskStages = [] } = useTaskTemplateStages(selectedTaskTemplate?.id);
  const { data: taskItems = [] } = useSubfunnelTemplateItems(selectedTaskTemplate?.id);
  const createTaskStage = useCreateTaskTemplateStage(selectedTaskTemplate?.id || 0);
  const patchTaskStage = usePatchTaskTemplateStage();
  const deleteTaskStage = useDeleteTaskTemplateStage();
  const createTaskItem = useCreateSubfunnelTemplateItem(selectedTaskTemplate?.id || 0);
  const patchTaskItem = usePatchSubfunnelTemplateItem();
  const deleteTaskItem = useDeleteSubfunnelTemplateItem();
  const [taskStageModalOpen, setTaskStageModalOpen] = useState(false);
  const [taskChecklistModalOpen, setTaskChecklistModalOpen] = useState(false);
  const [editingTaskChecklistItem, setEditingTaskChecklistItem] = useState<SubfunnelTemplateItem | null>(null);
  const [taskStageForm] = Form.useForm();
  const [taskChecklistForm] = Form.useForm();

  const roleOptions = (rolesData?.results || []).map((r) => ({ value: r.id, label: r.name }));
  const userOptions = (usersData?.results || []).map((u) => ({ value: u.id, label: u.full_name || u.username }));
  const taskStatusOptions = TASK_WORKFLOW_STATUSES.map((status) => ({
    value: status,
    label: TASK_STATUS_META[status]?.label || status,
  }));

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const { name, description, tags } = values;
      const result = await createFunnel.mutateAsync({
        name,
        description,
        tags: tags || [],
      });
      message.success('Воронка создана');
      setModalOpen(false);
      form.resetFields();
      navigate(`/funnels/${result.id}`);
    } catch {
      // validation error
    }
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Удалить воронку?',
      content: 'Это действие нельзя отменить.',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        await deleteFunnel.mutateAsync(id);
        message.success('Воронка удалена');
      },
    });
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Funnel) => (
        <a onClick={() => navigate(`/funnels/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Стадий',
      dataIndex: 'stages_count',
      key: 'stages_count',
      width: 100,
      align: 'center' as const,
    },
    {
      title: 'Теги',
      key: 'tags',
      width: 220,
      render: (_: unknown, row: Funnel) =>
        renderTagChips(row.tag_names, tagsCatalog?.results, row.tags) || '—',
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? 'Активна' : 'Неактивна'}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, record: Funnel) => (
        <Button type="link" danger size="small" onClick={() => handleDelete(record.id)}>
          Удалить
        </Button>
      ),
    },
  ];

  const taskFunnels = useMemo(
    () => (subfunnelTemplates?.results || []).filter((t) => isCanonicalTaskFunnel(t.slug)),
    [subfunnelTemplates],
  );

  const selectedTaskTemplateLive = selectedTaskTemplate
    ? taskFunnels.find((t) => t.id === selectedTaskTemplate.id) || selectedTaskTemplate
    : null;

  const sortedTaskStages = useMemo(
    () => [...taskStages].sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id - b.id)),
    [taskStages],
  );
  const checklistItems = useMemo(
    () => taskItems.filter((item) => item.execution_type !== 'stage'),
    [taskItems],
  );

  const checklistGroups = useMemo(() => {
    const byStage = new Map<string, { key: string; label: string; rows: SubfunnelTemplateItem[] }>();
    for (const stage of sortedTaskStages) {
      byStage.set(String(stage.id), {
        key: String(stage.id),
        label: `${stage.order}. ${stage.name}`,
        rows: [],
      });
    }
    byStage.set('none', { key: 'none', label: 'Без этапа', rows: [] });
    for (const item of checklistItems) {
      const key = item.stage ? String(item.stage) : 'none';
      const group = byStage.get(key);
      if (group) group.rows.push(item);
    }
    return [...byStage.values()].filter((g) => g.rows.length > 0 || g.key !== 'none');
  }, [checklistItems, sortedTaskStages]);

  async function handleCreateTaskTemplate() {
    try {
      const values = await taskTemplateForm.validateFields();
      await createTaskTemplate.mutateAsync({
        name: values.name,
        description: values.description || '',
        owner_role: values.owner_role || null,
        is_active: true,
        auto_create_on_collect_import: values.auto_create_on_collect_import ?? true,
      });
      message.success('Воронка задач создана');
      setTaskTemplateModalOpen(false);
      taskTemplateForm.resetFields();
    } catch (err) {
      message.error(getAxiosErrorMessage(err));
    }
  }

  async function handleCreateTaskStage() {
    try {
      const values = await taskStageForm.validateFields();
      await createTaskStage.mutateAsync({
        name: values.name,
        order: values.order ?? sortedTaskStages.length,
        sla_days: values.sla_days ?? 0,
        is_work_stage: !!values.is_work_stage,
        is_active: !!values.is_active,
        is_terminal: !!values.is_terminal,
        task_status: values.task_status || 'in_progress',
      });
      message.success('Стадия добавлена');
      setTaskStageModalOpen(false);
      taskStageForm.resetFields();
    } catch {
      // validation
    }
  }

  async function handleCreateChecklistItem() {
    try {
      const values = await taskChecklistForm.validateFields();
      if (editingTaskChecklistItem) {
        await patchTaskItem.mutateAsync({
          id: editingTaskChecklistItem.id,
          title: values.title,
          order: values.order ?? editingTaskChecklistItem.order,
          execution_type: values.execution_type || 'checklist_item',
          stage: values.stage ?? null,
          default_role: values.default_role ?? null,
          default_specialist: values.default_specialist ?? null,
        });
        message.success('Пункт чеклиста обновлён');
      } else {
        await createTaskItem.mutateAsync({
          title: values.title,
          order: values.order ?? checklistItems.length,
          execution_type: values.execution_type || 'checklist_item',
          stage: values.stage ?? null,
          default_role: values.default_role ?? null,
          default_specialist: values.default_specialist ?? null,
        });
        message.success('Пункт чеклиста добавлен');
      }
      setTaskChecklistModalOpen(false);
      setEditingTaskChecklistItem(null);
      taskChecklistForm.resetFields();
    } catch {
      // validation
    }
  }

  const taskTemplateColumns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Роль',
      dataIndex: 'owner_role_name',
      key: 'owner_role_name',
      render: (v?: string | null) => v || '—',
    },
    {
      title: 'Активна',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (v: boolean, row: SubfunnelTemplate) => (
        <Switch
          size="small"
          checked={v}
          onChange={(checked) => patchTaskTemplate.mutate({ id: row.id, is_active: checked })}
        />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 180,
      render: (_: unknown, row: SubfunnelTemplate) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setSelectedTaskTemplate(row); setTaskTemplateEditorOpen(true); }}>
            Редактировать
          </Button>
          {!isCanonicalTaskFunnel(row.slug) && (
            <Popconfirm
              title="Удалить воронку задач?"
              okText="Удалить"
              cancelText="Отмена"
              onConfirm={async () => {
                await deleteTaskTemplate.mutateAsync(row.id);
                if (selectedTaskTemplate?.id === row.id) {
                  setTaskTemplateEditorOpen(false);
                  setSelectedTaskTemplate(null);
                }
                message.success('Воронка задач удалена');
              }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Воронки (сценарии)</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Создать воронку
        </Button>
      </Space>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          if (key === 'tasks') {
            setSearchParams({ tab: 'tasks' });
          } else {
            setSearchParams({});
          }
        }}
        items={[
          {
            key: 'campaign',
            label: 'Воронки кампаний',
            children: (
              <Card>
                <Space className="filter-bar" style={{ marginBottom: 12 }} wrap>
                  <Typography.Text type="secondary">Фильтр по тегам:</Typography.Text>
                  <EntityTagSelect
                    availableTags={tagsCatalog?.results ?? []}
                    value={tagFilter}
                    onChange={setTagFilter}
                    placeholder="Все воронки"
                    style={{ minWidth: 260, maxWidth: '100%' }}
                  />
                </Space>
                <ResponsiveTable
                  dataSource={funnels?.results || []}
                  columns={columns}
                  rowKey="id"
                  loading={isLoading}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'tasks',
            label: 'Воронки задач',
            children: (
              <Card>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                  Системные воронки задач. Редактируйте стадии и чеклисты здесь; привязку к стадиям воронки кампании
                  настраивайте на странице конкретной воронки кампании.
                </Typography.Paragraph>
                <ResponsiveTable
                  dataSource={taskFunnels}
                  columns={taskTemplateColumns}
                  rowKey="id"
                  loading={isTaskTemplatesLoading}
                  pagination={false}
                  locale={{ emptyText: 'Воронки задач не созданы' }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="Новая воронка"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createFunnel.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Укажите название' }]}>
            <Input placeholder='Например: "РОИВ (базовый)"' />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="Краткое описание сценария" />
          </Form.Item>
          <Form.Item name="tags" label="Теги">
            <EntityTagSelect
              availableTags={tagsCatalog?.results ?? []}
              placeholder="Необязательно"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Новая воронка задач"
        open={taskTemplateModalOpen}
        onOk={handleCreateTaskTemplate}
        onCancel={() => { setTaskTemplateModalOpen(false); taskTemplateForm.resetFields(); }}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createTaskTemplate.isPending}
      >
        <Form form={taskTemplateForm} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Укажите название' }]}>
            <Input placeholder="Например: Первичный контакт и фиксация результата" />
          </Form.Item>
          <Form.Item name="owner_role" label="Роль-владелец">
            <Select allowClear options={roleOptions} />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="auto_create_on_collect_import"
            label="Создавать карточки при добавлении/импорте организаций и контактов"
            valuePropName="checked"
            initialValue
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={selectedTaskTemplateLive ? `Воронка задач: ${selectedTaskTemplateLive.name}` : 'Воронка задач'}
        width={980}
        open={taskTemplateEditorOpen}
        onClose={() => {
          setTaskTemplateEditorOpen(false);
          setSelectedTaskTemplate(null);
        }}
      >
        {!selectedTaskTemplateLive ? (
          <Empty description="Выберите воронку задач" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card size="small" title="Параметры">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input
                  value={selectedTaskTemplateLive.name}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== selectedTaskTemplateLive.name) {
                      patchTaskTemplate.mutate({ id: selectedTaskTemplateLive.id, name: next });
                    }
                  }}
                />
                <Space>
                  <Typography.Text style={{ minWidth: 92 }}>Роль:</Typography.Text>
                  <Select
                    allowClear
                    style={{ width: 360 }}
                    value={selectedTaskTemplateLive.owner_role ?? undefined}
                    options={roleOptions}
                    placeholder="Роль-владелец"
                    onChange={(next) => patchTaskTemplate.mutate({ id: selectedTaskTemplateLive.id, owner_role: next ?? null })}
                  />
                </Space>
                <Space>
                  <Typography.Text>Активна:</Typography.Text>
                  <Switch
                    checked={selectedTaskTemplateLive.is_active}
                    onChange={(checked) => patchTaskTemplate.mutate({ id: selectedTaskTemplateLive.id, is_active: checked })}
                  />
                </Space>
                <Space>
                  <Typography.Text>Карточки из добавления/импорта:</Typography.Text>
                  <Switch
                    checked={selectedTaskTemplateLive.auto_create_on_collect_import}
                    onChange={(checked) =>
                      patchTaskTemplate.mutate({
                        id: selectedTaskTemplateLive.id,
                        auto_create_on_collect_import: checked,
                      })
                    }
                  />
                </Space>
              </Space>
            </Card>

            <Card
              size="small"
              title="Стадии в работе"
              extra={(
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    taskStageForm.setFieldsValue({
                      order: sortedTaskStages.length,
                      sla_days: 0,
                      is_work_stage: true,
                      is_active: true,
                      is_terminal: false,
                      task_status: 'in_progress',
                    });
                    setTaskStageModalOpen(true);
                  }}
                >
                  Добавить стадию
                </Button>
              )}
            >
              <ResponsiveTable
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={sortedTaskStages}
                locale={{ emptyText: 'Стадии не настроены' }}
                columns={[
                  { title: 'Порядок', dataIndex: 'order', key: 'order', width: 90 },
                  { title: 'Название', dataIndex: 'name', key: 'name' },
                  {
                    title: 'В работе',
                    dataIndex: 'is_work_stage',
                    key: 'is_work_stage',
                    width: 110,
                    render: (v: boolean, row: any) => (
                      <Switch
                        size="small"
                        checked={v}
                        onChange={(checked) => patchTaskStage.mutate({ id: row.id, is_work_stage: checked })}
                      />
                    ),
                  },
                  {
                    title: 'Вкл.',
                    dataIndex: 'is_active',
                    key: 'is_active',
                    width: 90,
                    render: (v: boolean, row: any) => (
                      <Switch
                        size="small"
                        checked={v}
                        onChange={(checked) => patchTaskStage.mutate({ id: row.id, is_active: checked })}
                      />
                    ),
                  },
                  {
                    title: 'Статус задачи',
                    dataIndex: 'task_status',
                    key: 'task_status',
                    width: 190,
                    render: (v: TaskWorkflowStatus, row: any) => (
                      <Select
                        size="small"
                        value={v}
                        options={taskStatusOptions}
                        style={{ width: '100%' }}
                        onChange={(taskStatus: TaskWorkflowStatus) =>
                          patchTaskStage.mutate({ id: row.id, task_status: taskStatus })
                        }
                      />
                    ),
                  },
                  {
                    title: 'Финал',
                    dataIndex: 'is_terminal',
                    key: 'is_terminal',
                    width: 90,
                    render: (v: boolean, row: any) => (
                      <Switch
                        size="small"
                        checked={v}
                        onChange={(checked) => patchTaskStage.mutate({ id: row.id, is_terminal: checked })}
                      />
                    ),
                  },
                  {
                    title: 'SLA',
                    dataIndex: 'sla_days',
                    key: 'sla_days',
                    width: 120,
                    render: (v: number, row: any) => (
                      <InputNumber
                        min={0}
                        size="small"
                        value={v}
                        onChange={(next) => patchTaskStage.mutate({ id: row.id, sla_days: next ?? 0 })}
                      />
                    ),
                  },
                  {
                    title: '',
                    key: 'delete',
                    width: 70,
                    render: (_: unknown, row: any) => (
                      <Popconfirm
                        title="Удалить стадию?"
                        onConfirm={() => deleteTaskStage.mutate({ id: row.id, templateId: selectedTaskTemplateLive.id })}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ),
                  },
                ]}
              />
            </Card>

            <Card
              size="small"
              title="Чеклист по стадиям"
              extra={(
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    setEditingTaskChecklistItem(null);
                    taskChecklistForm.setFieldsValue({ order: checklistItems.length, stage: undefined });
                    setTaskChecklistModalOpen(true);
                  }}
                >
                  Добавить пункт
                </Button>
              )}
            >
              {checklistGroups.length === 0 ? (
                <Empty description="Пункты чеклиста не добавлены" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Collapse
                  items={checklistGroups.map((group) => ({
                    key: group.key,
                    label: `${group.label} (${group.rows.length})`,
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }} size={8}>
                        {group.rows
                          .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id - b.id))
                          .map((item) => (
                            <Space key={item.id} align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                              <Space direction="vertical" size={2}>
                                <Typography.Text strong>{item.order}. {item.title}</Typography.Text>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                  Тип: {item.execution_type} · Этап: {sortedTaskStages.find((s) => s.id === item.stage)?.name || '—'}
                                  {' '}· Роль: {roleOptions.find((r) => r.value === item.default_role)?.label || '—'}
                                  {' '}· Исполнитель: {userOptions.find((u) => u.value === item.default_specialist)?.label || '—'}
                                </Typography.Text>
                              </Space>
                              <Space size="small">
                                <Button
                                  size="small"
                                  onClick={() => {
                                    setEditingTaskChecklistItem(item);
                                    taskChecklistForm.setFieldsValue({
                                      title: item.title,
                                      order: item.order,
                                      execution_type: item.execution_type,
                                      stage: item.stage ?? undefined,
                                      default_role: item.default_role ?? undefined,
                                      default_specialist: item.default_specialist ?? undefined,
                                    });
                                    setTaskChecklistModalOpen(true);
                                  }}
                                >
                                  Изменить
                                </Button>
                                <Button danger icon={<DeleteOutlined />} onClick={() => deleteTaskItem.mutate(item.id)} />
                              </Space>
                            </Space>
                          ))}
                      </Space>
                    ),
                  }))}
                />
              )}
              <Divider style={{ margin: '12px 0 0' }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Для отключения этапа переключите “Вкл.”. Для этапов, которые должны считаться рабочими, включите “В работе”.
              </Typography.Text>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="Новая стадия воронки задач"
        open={taskStageModalOpen}
        onCancel={() => {
          setTaskStageModalOpen(false);
          taskStageForm.resetFields();
        }}
        onOk={handleCreateTaskStage}
        confirmLoading={createTaskStage.isPending}
      >
        <Form form={taskStageForm} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Укажите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="order" label="Порядок" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sla_days" label="SLA (дней)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="task_status" label="Статус задачи" initialValue="in_progress">
            <Select options={taskStatusOptions} />
          </Form.Item>
          <Form.Item name="is_work_stage" label="Считать стадией в работе" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
          <Form.Item name="is_active" label="Активна" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
          <Form.Item name="is_terminal" label="Финальный этап" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingTaskChecklistItem ? 'Редактировать пункт чеклиста' : 'Новый пункт чеклиста'}
        open={taskChecklistModalOpen}
        onCancel={() => {
          setTaskChecklistModalOpen(false);
          setEditingTaskChecklistItem(null);
          taskChecklistForm.resetFields();
        }}
        onOk={handleCreateChecklistItem}
        confirmLoading={createTaskItem.isPending || patchTaskItem.isPending}
      >
        <Form form={taskChecklistForm} layout="vertical">
          <Form.Item name="title" label="Название пункта" rules={[{ required: true, message: 'Укажите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="execution_type" label="Тип исполнения" initialValue="checklist_item">
            <Select
              options={[
                { value: 'checklist_item', label: 'Пункт чек-листа' },
                { value: 'stage_range_checklist', label: 'Чек-лист диапазона стадий' },
                { value: 'stage', label: 'Отдельная стадия' },
              ]}
            />
          </Form.Item>
          <Form.Item name="stage" label="Этап">
            <Select
              allowClear
              options={sortedTaskStages.map((s) => ({ value: s.id, label: `${s.order}. ${s.name}` }))}
            />
          </Form.Item>
          <Form.Item name="order" label="Порядок" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="default_role" label="Роль по умолчанию">
            <Select allowClear options={roleOptions} />
          </Form.Item>
          <Form.Item name="default_specialist" label="Исполнитель по умолчанию">
            <Select allowClear options={userOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Space, Spin, Input, Switch, Form, Modal,
  Select, InputNumber, Collapse, Tag, Popconfirm, App, Empty, Tooltip,
} from 'antd';
import ResponsiveTable from '../../components/responsive/ResponsiveTable';
import {
  ArrowLeftOutlined, ArrowUpOutlined, ArrowDownOutlined,
  PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined,
} from '@ant-design/icons';
import {
  useFunnel, useUpdateFunnel,
  useCreateFunnelStage, useUpdateFunnelStage, useDeleteFunnelStage,
  useCreateChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem,
  useCreateChecklistOption, useDeleteChecklistOption,
  useOrganizationTags, useUsers,
  useSubfunnelBindings, useSubfunnelTemplates, useCreateSubfunnelBinding, usePatchSubfunnelBinding, useDeleteSubfunnelBinding, useRoles,
} from '../../api/hooks';
import type { FunnelStage, StageChecklistItem, SubfunnelTemplateBinding } from '../../types';
import EntityTagSelect from '../../components/EntityTagSelect';
import { isCanonicalTaskFunnel } from '../../utils/taskFunnelCatalog';

/** Типы подтверждения (можно несколько). Пустой список — без подтверждения. */
const confirmationTypeOptions = [
  { value: 'text', label: 'Текст' },
  { value: 'file', label: 'Файл(ы)' },
  { value: 'select', label: 'Выбор из списка' },
  { value: 'contact', label: 'Контакт' },
];

const communicationStepOptions = [
  { value: '', label: 'Без шага' },
  { value: 'email_prepared', label: 'Письмо подготовлено' },
  { value: 'email_sent', label: 'Письмо отправлено' },
  { value: 'response_received', label: 'Ответ получен' },
  { value: 'result_recorded', label: 'Результат зафиксирован' },
];

const stageRoleOptions = [
  { value: 'manager', label: 'Менеджер' },
  { value: 'primary_contact_specialist', label: 'Специалист по первичному контакту' },
];

export default function FunnelDetailPage() {
  const { message } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: funnel, isLoading } = useFunnel(id!);
  const updateFunnel = useUpdateFunnel(id!);
  const createStage = useCreateFunnelStage(id!);
  const updateStage = useUpdateFunnelStage(id!);
  const deleteStage = useDeleteFunnelStage(id!);
  const createItem = useCreateChecklistItem(id!);
  const updateItem = useUpdateChecklistItem(id!);
  const deleteItem = useDeleteChecklistItem(id!);
  const createOption = useCreateChecklistOption(id!);
  const deleteOption = useDeleteChecklistOption(id!);
  const { data: tagsCatalog } = useOrganizationTags({ page_size: 500, tag_type: 'funnels' });
  const { data: usersData } = useUsers();
  const { data: bindings } = useSubfunnelBindings(id!);
  const { data: subfunnelTemplates } = useSubfunnelTemplates({ is_active: true, page_size: 200 });
  const { data: rolesData } = useRoles({ is_active: true, page_size: 200 });
  const createSubfunnelBinding = useCreateSubfunnelBinding(id!);
  const patchSubfunnelBinding = usePatchSubfunnelBinding(id!);
  const deleteSubfunnelBinding = useDeleteSubfunnelBinding(id!);
  const taskFunnelOptions = (subfunnelTemplates?.results || [])
    .filter((t) => isCanonicalTaskFunnel(t.slug))
    .map((t) => ({ value: t.id, label: t.name }));
  const userOptions = (usersData?.results || []).map((u) => ({
    value: u.id,
    label: u.full_name || u.username,
  }));

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [stageForm] = Form.useForm();
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingChecklistItem, setEditingChecklistItem] = useState<StageChecklistItem | null>(null);
  const [itemForm] = Form.useForm();
  const [activeStageId, setActiveStageId] = useState<number | null>(null);
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [optionItemId, setOptionItemId] = useState<number | null>(null);
  const [optionValue, setOptionValue] = useState('');
  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [bindingForm] = Form.useForm();
  const [editingBinding, setEditingBinding] = useState<SubfunnelTemplateBinding | null>(null);

  if (isLoading) return <div style={{ textAlign: 'center', paddingTop: 100 }}><Spin size="large" /></div>;
  if (!funnel) return <Typography.Text>Воронка не найдена</Typography.Text>;

  const handleSaveName = async () => {
    if (!nameValue.trim()) return;
    await updateFunnel.mutateAsync({ name: nameValue });
    setEditingName(false);
    message.success('Название обновлено');
  };

  const handleToggleActive = async (checked: boolean) => {
    await updateFunnel.mutateAsync({ is_active: checked });
    message.success(checked ? 'Воронка активирована' : 'Воронка деактивирована');
  };

  const handleCreateStage = async () => {
    try {
      const values = await stageForm.validateFields();
      const payload = values.is_collect_stage
        ? { ...values, selection_mode: 'regions', order: 0 }
        : values;
      await createStage.mutateAsync(payload);
      message.success('Стадия добавлена');
      setStageModalOpen(false);
      stageForm.resetFields();
    } catch { /* validation */ }
  };

  const handleDeleteStage = async (stageId: number) => {
    await deleteStage.mutateAsync(stageId);
    message.success('Стадия удалена');
  };

  const handleUpdateStageDeadline = async (stageId: number, days: number | null) => {
    if (days === null) return;
    await updateStage.mutateAsync({ stageId, deadline_days: days });
  };

  const handleUpdateStageSpecialist = async (stageId: number, specialistId?: number) => {
    await updateStage.mutateAsync({
      stageId,
      primary_contact_specialist: specialistId ?? null,
    });
  };

  const handleUpdateStageRole = async (
    stageId: number,
    role: 'manager' | 'primary_contact_specialist',
  ) => {
    await updateStage.mutateAsync({
      stageId,
      responsible_role: role,
    });
  };

  const handleSaveItem = async () => {
    try {
      const values = await itemForm.validateFields();
      if (editingChecklistItem) {
        await updateItem.mutateAsync({
          itemId: editingChecklistItem.id,
          text: values.text,
          order: values.order,
          confirmation_types: values.confirmation_types ?? [],
          primary_contact_specialist: values.primary_contact_specialist ?? null,
          communication_step: values.communication_step ?? '',
        });
        message.success('Пункт обновлён');
      } else {
        await createItem.mutateAsync({
          ...values,
          stage: activeStageId,
          confirmation_types: values.confirmation_types ?? [],
          primary_contact_specialist: values.primary_contact_specialist ?? null,
          communication_step: values.communication_step ?? '',
        });
        message.success('Пункт добавлен');
      }
      setItemModalOpen(false);
      setEditingChecklistItem(null);
      itemForm.resetFields();
    } catch { /* validation */ }
  };

  const closeItemModal = () => {
    setItemModalOpen(false);
    setEditingChecklistItem(null);
    itemForm.resetFields();
  };

  const openEditItem = (item: StageChecklistItem) => {
    setEditingChecklistItem(item);
    itemForm.setFieldsValue({
      text: item.text,
      order: item.order,
      confirmation_types: item.confirmation_types ?? [],
      primary_contact_specialist: item.primary_contact_specialist ?? null,
      communication_step: item.communication_step ?? '',
    });
    setItemModalOpen(true);
  };

  const moveChecklistItem = async (stage: FunnelStage, itemId: number, direction: 'up' | 'down') => {
    const sorted = [...stage.checklist_items].sort((a, b) =>
      a.order !== b.order ? a.order - b.order : a.id - b.id,
    );
    const idx = sorted.findIndex((i) => i.id === itemId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const arr = [...sorted];
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].order !== i) {
        await updateItem.mutateAsync({ itemId: arr[i].id, order: i });
      }
    }
    message.success('Порядок обновлён');
  };

  const handleDeleteItem = async (itemId: number) => {
    await deleteItem.mutateAsync(itemId);
    message.success('Пункт удалён');
  };

  const handleUpdateItemTypes = async (
    itemId: number,
    types: StageChecklistItem['confirmation_types'],
  ) => {
    await updateItem.mutateAsync({ itemId, confirmation_types: types });
  };

  const handleAddOption = async () => {
    if (!optionValue.trim() || !optionItemId) return;
    const item = funnel.stages
      .flatMap(s => s.checklist_items)
      .find(i => i.id === optionItemId);
    const nextOrder = item ? item.options.length : 0;
    await createOption.mutateAsync({
      checklist_item: optionItemId,
      value: optionValue.trim(),
      order: nextOrder,
    });
    setOptionValue('');
    setOptionModalOpen(false);
    message.success('Вариант добавлен');
  };

  const handleDeleteOption = async (optionId: number) => {
    await deleteOption.mutateAsync(optionId);
    message.success('Вариант удалён');
  };

  const renderChecklistItem = (stage: FunnelStage, item: StageChecklistItem, index: number, total: number) => (
    <div
      key={item.id}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '8px 0', borderBottom: '1px solid #f5f5f5',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <Typography.Text strong>{index + 1}. {item.text}</Typography.Text>
        <div style={{ marginTop: 4 }}>
          <Select
            mode="multiple"
            allowClear
            placeholder="Без подтверждения"
            size="small"
            value={item.confirmation_types ?? []}
            onChange={(v) => handleUpdateItemTypes(item.id, v)}
            options={confirmationTypeOptions}
            style={{ minWidth: 220, maxWidth: '100%' }}
          />
          <Select
            size="small"
            allowClear
            placeholder="Шаг коммуникации"
            value={item.communication_step || ''}
            style={{ minWidth: 220, maxWidth: '100%', marginLeft: 8 }}
            options={communicationStepOptions}
            onChange={(v) =>
              updateItem.mutateAsync({
                itemId: item.id,
                communication_step: ((v as StageChecklistItem['communication_step']) || ''),
              })
            }
          />
          <Select
            size="small"
            allowClear
            placeholder="Специалист по первичному контакту"
            value={item.primary_contact_specialist ?? undefined}
            style={{ minWidth: 260, maxWidth: '100%', marginLeft: 8 }}
            options={userOptions}
            onChange={(v) =>
              updateItem.mutateAsync({
                itemId: item.id,
                primary_contact_specialist: v ?? null,
              })
            }
          />
          {(item.confirmation_types ?? []).includes('select') && (
            <div style={{ marginTop: 4, marginLeft: 8 }}>
              {item.options.map(opt => (
                <Tag
                  key={opt.id}
                  closable
                  onClose={() => handleDeleteOption(opt.id)}
                  style={{ marginBottom: 4 }}
                >
                  {opt.value}
                </Tag>
              ))}
              <Tag
                style={{ cursor: 'pointer', borderStyle: 'dashed' }}
                onClick={() => { setOptionItemId(item.id); setOptionModalOpen(true); }}
              >
                <PlusOutlined /> Вариант
              </Tag>
            </div>
          )}
        </div>
      </div>
      <Space size={4} wrap={false} style={{ flexShrink: 0, alignItems: 'flex-start' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: '24px', marginRight: 4 }}>
          Порядок:
        </Typography.Text>
        <Button.Group size="small">
          <Tooltip title="Выше">
            <Button
              type="default"
              icon={<ArrowUpOutlined />}
              disabled={index === 0 || updateItem.isPending}
              onClick={() => moveChecklistItem(stage, item.id, 'up')}
            />
          </Tooltip>
          <Tooltip title="Ниже">
            <Button
              type="default"
              icon={<ArrowDownOutlined />}
              disabled={index >= total - 1 || updateItem.isPending}
              onClick={() => moveChecklistItem(stage, item.id, 'down')}
            />
          </Tooltip>
        </Button.Group>
        <Button
          type="default"
          size="small"
          icon={<EditOutlined />}
          onClick={() => openEditItem(item)}
        >
          Изменить
        </Button>
        <Popconfirm title="Удалить пункт?" onConfirm={() => handleDeleteItem(item.id)} okText="Да" cancelText="Нет">
          <Button type="default" danger size="small" icon={<DeleteOutlined />}>
            Удалить
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );

  const stageItems = funnel.stages.map((stage: FunnelStage) => ({
    key: String(stage.id),
    label: (
      <Space>
        <Typography.Text strong>{stage.order}. {stage.name}</Typography.Text>
        <Tag>{stage.deadline_days} раб. дн.</Tag>
        {stage.is_collect_stage && <Tag color="cyan">Сбор лидов (нулевая)</Tag>}
        <Tag color="geekblue">
          Роль: {stage.responsible_role === 'primary_contact_specialist' ? 'Специалист' : 'Менеджер'}
        </Tag>
        {stage.primary_contact_specialist_name && (
          <Tag color="purple">Специалист по умолчанию: {stage.primary_contact_specialist_name}</Tag>
        )}
        <Typography.Text type="secondary">
          ({stage.checklist_items.length} пункт.)
        </Typography.Text>
      </Space>
    ),
    extra: (
      <Space onClick={(e) => e.stopPropagation()}>
        <InputNumber
          size="small"
          min={0}
          value={stage.deadline_days}
          onChange={(v) => handleUpdateStageDeadline(stage.id, v)}
          style={{ width: 80 }}
          addonAfter="дн."
        />
        {!stage.is_rejection && (
          <Select
            size="small"
            style={{ width: 200 }}
            value={stage.responsible_role ?? 'manager'}
            options={stageRoleOptions}
            onChange={(v) => handleUpdateStageRole(stage.id, v)}
          />
        )}
        {!stage.is_rejection && (
          <Select
            allowClear
            size="small"
            placeholder="Специалист по умолчанию"
            style={{ width: 220 }}
            value={stage.primary_contact_specialist ?? undefined}
            options={userOptions}
            onChange={(v) => handleUpdateStageSpecialist(stage.id, v)}
          />
        )}
        <Popconfirm title="Удалить стадию?" onConfirm={() => handleDeleteStage(stage.id)} okText="Да" cancelText="Нет">
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
    children: (
      <div>
        {stage.checklist_items.length === 0 ? (
          <Empty description="Нет пунктов чек-листа" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          [...stage.checklist_items]
            .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id - b.id))
            .map((item, idx, arr) => renderChecklistItem(stage, item, idx, arr.length))
        )}
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          style={{ marginTop: 8 }}
          onClick={() => {
            setActiveStageId(stage.id);
            setEditingChecklistItem(null);
            itemForm.setFieldsValue({
              order: stage.checklist_items.length,
              confirmation_types: [],
              communication_step: '',
              primary_contact_specialist: null,
            });
            setItemModalOpen(true);
          }}
        >
          Добавить пункт
        </Button>
      </div>
    ),
  }));
  const checklistTargetOptions = funnel.stages
    .flatMap((s) => (s.checklist_items || []).map((i) => ({ value: i.id, label: `${s.name} / ${i.text}` })));
  const stageNameById = new Map(funnel.stages.map((s) => [s.id, s.name]));
  const checklistItemLabelById = new Map(
    funnel.stages.flatMap((s) =>
      (s.checklist_items || []).map((i) => [i.id, `${s.name} / ${i.text}`] as const),
    ),
  );

  const renderBindingTarget = (row: SubfunnelTemplateBinding) => {
    if (row.binding_type === 'stage') {
      return row.target_stage ? (stageNameById.get(row.target_stage) || `Стадия #${row.target_stage}`) : '—';
    }
    if (row.binding_type === 'checklist_item') {
      return row.target_checklist_item
        ? (checklistItemLabelById.get(row.target_checklist_item) || `Пункт #${row.target_checklist_item}`)
        : '—';
    }
    const from = row.from_stage ? (stageNameById.get(row.from_stage) || `#${row.from_stage}`) : null;
    const to = row.to_stage ? (stageNameById.get(row.to_stage) || `#${row.to_stage}`) : null;
    return from && to ? `${from} → ${to}` : '—';
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/funnels')}>
          Назад
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editingName ? (
            <Space>
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onPressEnter={handleSaveName}
                style={{ width: 400, maxWidth: '100%' }}
              />
              <Button icon={<SaveOutlined />} type="primary" size="small" onClick={handleSaveName} />
            </Space>
          ) : (
            <Space>
              <Typography.Title level={4} style={{ margin: 0 }}>{funnel.name}</Typography.Title>
              <Button
                type="text" size="small" icon={<EditOutlined />}
                onClick={() => { setEditingName(true); setNameValue(funnel.name); }}
              />
            </Space>
          )}
          <Space>
            <Typography.Text>Активна:</Typography.Text>
            <Switch checked={funnel.is_active} onChange={handleToggleActive} />
          </Space>
        </div>
        {funnel.description && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            {funnel.description}
          </Typography.Paragraph>
        )}
        <div style={{ marginTop: 12, maxWidth: 640 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Теги воронки
          </Typography.Text>
          <EntityTagSelect
            availableTags={tagsCatalog?.results ?? []}
            value={funnel.tags ?? []}
            onChange={async (tagIds) => {
              try {
                await updateFunnel.mutateAsync({ tags: tagIds });
                message.success('Теги сохранены');
              } catch {
                message.error('Не удалось сохранить теги');
              }
            }}
          />
        </div>
      </Card>

      <Card
        title="Стадии воронки"
        extra={
          <Button
            type="primary" size="small" icon={<PlusOutlined />}
            onClick={() => {
              stageForm.setFieldsValue({
                order: funnel.stages.length,
                deadline_days: 0,
                is_collect_stage: false,
                selection_mode: '',
                responsible_role: 'manager',
              });
              setStageModalOpen(true);
            }}
          >
            Добавить стадию
          </Button>
        }
      >
        {stageItems.length === 0 ? (
          <Empty description="Стадии не добавлены" />
        ) : (
          <Collapse items={stageItems} />
        )}
      </Card>

      <Card
        title="Задачи воронки"
        style={{ marginTop: 16 }}
        extra={(
          <Space>
            <Button type="link" onClick={() => navigate('/funnels?tab=tasks')}>
              Воронки задач
            </Button>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setBindingModalOpen(true)}>
              Привязать задачу
            </Button>
          </Space>
        )}
      >
        <ResponsiveTable
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={bindings || []}
          columns={[
            { title: 'Шаблон', dataIndex: 'template_name', key: 'template_name' },
            {
              title: 'Тип привязки',
              dataIndex: 'binding_type',
              key: 'binding_type',
              render: (v: string) => (
                v === 'stage' ? 'Стадия' : v === 'checklist_item' ? 'Пункт чек-листа' : 'Диапазон стадий'
              ),
            },
            {
              title: 'Привязка к стадии/пункту',
              key: 'binding_target',
              render: (_: unknown, row: SubfunnelTemplateBinding) => renderBindingTarget(row),
            },
            {
              title: 'Роль',
              dataIndex: 'role_name',
              key: 'role_name',
              render: (v?: string | null) => v || '—',
            },
            {
              title: 'Специалист по умолчанию',
              dataIndex: 'default_specialist_name',
              key: 'default_specialist_name',
              render: (v?: string | null) => v || '—',
            },
            {
              title: 'Автоперевод лида',
              key: 'advance_lead_on_task_stage_forward',
              width: 170,
              render: (_: unknown, row: SubfunnelTemplateBinding) => (
                <Switch
                  size="small"
                  checked={!!row.advance_lead_on_task_stage_forward}
                  disabled={row.binding_type !== 'stage'}
                  onChange={(checked) =>
                    patchSubfunnelBinding.mutate({
                      id: row.id,
                      advance_lead_on_task_stage_forward: checked,
                    })
                  }
                />
              ),
            },
            {
              title: '',
              key: 'actions',
              width: 180,
              render: (_: unknown, row: SubfunnelTemplateBinding) => (
                <Space size="small">
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingBinding(row);
                      bindingForm.setFieldsValue({
                        template: row.template,
                        binding_type: row.binding_type,
                        target_stage: row.target_stage ?? undefined,
                        target_checklist_item: row.target_checklist_item ?? undefined,
                        from_stage: row.from_stage ?? undefined,
                        to_stage: row.to_stage ?? undefined,
                        role: row.role ?? undefined,
                        default_specialist: row.default_specialist ?? undefined,
                        advance_lead_on_task_stage_forward: !!row.advance_lead_on_task_stage_forward,
                      });
                      setBindingModalOpen(true);
                    }}
                  >
                    Изменить
                  </Button>
                  <Popconfirm
                    title="Удалить привязку задачи?"
                    okText="Удалить"
                    cancelText="Отмена"
                    onConfirm={async () => {
                      await deleteSubfunnelBinding.mutateAsync(row.id);
                      message.success('Привязка удалена');
                    }}
                  >
                    <Button size="small" danger loading={deleteSubfunnelBinding.isPending}>
                      Удалить
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          locale={{ emptyText: 'Привязки задач не настроены' }}
        />
      </Card>

      <Modal
        title="Новая стадия"
        open={stageModalOpen}
        onOk={handleCreateStage}
        onCancel={() => { setStageModalOpen(false); stageForm.resetFields(); }}
        okText="Добавить"
        cancelText="Отмена"
        confirmLoading={createStage.isPending}
      >
        <Form form={stageForm} layout="vertical">
          <Form.Item name="name" label="Название стадии" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input placeholder='Например: "Получить контакт"' />
          </Form.Item>
          <Form.Item
            name="is_collect_stage"
            label="Нулевая стадия сбора лидов"
            valuePropName="checked"
            tooltip="Для такой стадии автоматически включается отбор по регионам"
          >
            <Switch />
          </Form.Item>
          <Form.Item name="order" label="Порядковый номер">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="responsible_role" label="Роль этапа" initialValue="manager">
            <Select options={stageRoleOptions} />
          </Form.Item>
          <Form.Item name="deadline_days" label="Дедлайн (раб. дней от старта)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => (
              getFieldValue('is_collect_stage') ? (
                <>
                  <Form.Item name="selection_mode" label="Режим отбора" initialValue="regions">
                    <Select disabled options={[{ value: 'regions', label: 'По регионам' }]} />
                  </Form.Item>
                </>
              ) : null
            )}
          </Form.Item>
          <Form.Item name="primary_contact_specialist" label="Специалист по умолчанию">
            <Select allowClear options={userOptions} placeholder="Не назначен" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingChecklistItem ? 'Редактировать пункт чек-листа' : 'Новый пункт чек-листа'}
        open={itemModalOpen}
        onOk={handleSaveItem}
        onCancel={closeItemModal}
        okText={editingChecklistItem ? 'Сохранить' : 'Добавить'}
        cancelText="Отмена"
        confirmLoading={editingChecklistItem ? updateItem.isPending : createItem.isPending}
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item name="text" label="Текст пункта" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input placeholder='Например: "Получить исходящее письмо"' />
          </Form.Item>
          <Form.Item name="order" label="Порядок">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="confirmation_types"
            label="Типы подтверждения"
            tooltip="Можно выбрать несколько. Пусто — пункт без подтверждения."
            initialValue={[]}
          >
            <Select mode="multiple" allowClear placeholder="Без подтверждения" options={confirmationTypeOptions} />
          </Form.Item>
          <Form.Item
            name="communication_step"
            label="Шаг коммуникации специалиста"
            initialValue=""
          >
            <Select
              allowClear
              placeholder="Без шага"
              options={communicationStepOptions}
            />
          </Form.Item>
          <Form.Item name="primary_contact_specialist" label="Ответственный специалист">
            <Select allowClear options={userOptions} placeholder="Не назначен" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Добавить вариант"
        open={optionModalOpen}
        onOk={handleAddOption}
        onCancel={() => { setOptionModalOpen(false); setOptionValue(''); }}
        okText="Добавить"
        cancelText="Отмена"
      >
        <Input
          value={optionValue}
          onChange={(e) => setOptionValue(e.target.value)}
          placeholder="Текст варианта"
          onPressEnter={handleAddOption}
        />
      </Modal>

      <Modal
        title={editingBinding ? 'Изменить привязку задачи' : 'Новая привязка задачи'}
        open={bindingModalOpen}
        onCancel={() => {
          setBindingModalOpen(false);
          setEditingBinding(null);
          bindingForm.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await bindingForm.validateFields();
            if (editingBinding) {
              await patchSubfunnelBinding.mutateAsync({ id: editingBinding.id, ...values });
              message.success('Привязка обновлена');
            } else {
              await createSubfunnelBinding.mutateAsync(values);
              message.success('Задача привязана');
            }
            setBindingModalOpen(false);
            setEditingBinding(null);
            bindingForm.resetFields();
          } catch {
            // validation
          }
        }}
        confirmLoading={createSubfunnelBinding.isPending || patchSubfunnelBinding.isPending}
      >
        <Form form={bindingForm} layout="vertical">
          <Form.Item name="template" label="Шаблон задачи" rules={[{ required: true }]}>
            <Select
              options={taskFunnelOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="binding_type" label="Тип привязки" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'stage', label: 'К стадии' },
                { value: 'checklist_item', label: 'К пункту чек-листа' },
                { value: 'stage_range_checklist', label: 'К диапазону стадий' },
              ]}
            />
          </Form.Item>
          <Form.Item name="target_stage" label="Целевая стадия">
            <Select options={funnel.stages.map((s) => ({ value: s.id, label: s.name }))} allowClear />
          </Form.Item>
          <Form.Item name="target_checklist_item" label="Целевой пункт чек-листа">
            <Select options={checklistTargetOptions} allowClear showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="from_stage" label="Стадия начала диапазона">
            <Select options={funnel.stages.map((s) => ({ value: s.id, label: s.name }))} allowClear />
          </Form.Item>
          <Form.Item name="to_stage" label="Стадия окончания диапазона">
            <Select options={funnel.stages.map((s) => ({ value: s.id, label: s.name }))} allowClear />
          </Form.Item>
          <Form.Item name="role" label="Роль">
            <Select
              allowClear
              options={(rolesData?.results || []).map((r) => ({ value: r.id, label: r.name }))}
            />
          </Form.Item>
          <Form.Item name="default_specialist" label="Специалист по умолчанию">
            <Select allowClear options={userOptions} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => (
              getFieldValue('binding_type') === 'stage' ? (
                <Form.Item
                  name="advance_lead_on_task_stage_forward"
                  label="Автопереводить лид вперед при переводе карточки задачи"
                  valuePropName="checked"
                  initialValue={false}
                >
                  <Switch />
                </Form.Item>
              ) : null
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

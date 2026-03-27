import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Space, Spin, Input, Switch, Form, Modal,
  Select, InputNumber, Collapse, Tag, Popconfirm, App, Empty, Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined, ArrowUpOutlined, ArrowDownOutlined,
  PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined,
} from '@ant-design/icons';
import {
  useFunnel, useUpdateFunnel,
  useCreateFunnelStage, useUpdateFunnelStage, useDeleteFunnelStage,
  useCreateChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem,
  useCreateChecklistOption, useDeleteChecklistOption,
} from '../../api/hooks';
import type { FunnelStage, StageChecklistItem } from '../../types';

/** Типы подтверждения (можно несколько). Пустой список — без подтверждения. */
const confirmationTypeOptions = [
  { value: 'text', label: 'Текст' },
  { value: 'file', label: 'Файл(ы)' },
  { value: 'select', label: 'Выбор из списка' },
  { value: 'contact', label: 'Контакт' },
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
      await createStage.mutateAsync(values);
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

  const handleSaveItem = async () => {
    try {
      const values = await itemForm.validateFields();
      if (editingChecklistItem) {
        await updateItem.mutateAsync({
          itemId: editingChecklistItem.id,
          text: values.text,
          order: values.order,
          confirmation_types: values.confirmation_types ?? [],
        });
        message.success('Пункт обновлён');
      } else {
        await createItem.mutateAsync({
          ...values,
          stage: activeStageId,
          confirmation_types: values.confirmation_types ?? [],
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
            itemForm.setFieldsValue({ order: stage.checklist_items.length, confirmation_types: [] });
            setItemModalOpen(true);
          }}
        >
          Добавить пункт
        </Button>
      </div>
    ),
  }));

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
                style={{ width: 400 }}
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
      </Card>

      <Card
        title="Стадии воронки"
        extra={
          <Button
            type="primary" size="small" icon={<PlusOutlined />}
            onClick={() => {
              stageForm.setFieldsValue({ order: funnel.stages.length });
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
          <Form.Item name="order" label="Порядковый номер">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="deadline_days" label="Дедлайн (раб. дней от старта)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
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
    </div>
  );
}

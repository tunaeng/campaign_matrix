import { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Typography, Modal, Form, Input, App, Select, Tag, ColorPicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  useOrganizationTags,
  useCreateOrganizationTag,
  usePatchOrganizationTag,
  useDeleteOrganizationTag,
} from '../../api/hooks';
import type { OrganizationTag } from '../../types';
import { getAxiosErrorMessage } from '../../api/errorMessage';

const COLOR_PRESETS = [
  '#1677ff', '#52c41a', '#13c2c2', '#722ed1', '#eb2f96',
  '#fa8c16', '#f5222d', '#595959', '#2f54eb', '#389e0d',
];

/** Невидимые символы в «Коде» часто попадают с буфера — Django validate_unicode_slug их отвергает. */
function sanitizeTagSlugForSubmit(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || typeof raw !== 'string') return undefined;
  const stripped = raw
    .trim()
    .normalize('NFKC')
    .replace(/\p{Cf}+/gu, '')
    .trim();
  return stripped || undefined;
}

function pickAutoColor(tagName: string): string {
  const normalized = (tagName || '').trim().toLowerCase();
  if (!normalized) {
    return COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)]!;
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return COLOR_PRESETS[hash % COLOR_PRESETS.length]!;
}

export default function TagsAdminPage() {
  const { message } = App.useApp();
  const { data, isLoading, refetch } = useOrganizationTags({ page_size: 500 });
  const createTag = useCreateOrganizationTag();
  const patchTag = usePatchOrganizationTag();
  const deleteTag = useDeleteOrganizationTag();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationTag | null>(null);
  const [typeFilter, setTypeFilter] = useState<OrganizationTag['tag_type'] | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [form] = Form.useForm();
  const selectedColor = Form.useWatch('color', form);

  const rows = data?.results || [];
  const categories = useMemo(
    () => Array.from(new Set(rows.map((t) => (t.category || '').trim()).filter(Boolean))).sort(),
    [rows],
  );
  const filteredRows = rows.filter((row) => {
    if (typeFilter && typeFilter !== 'all' && row.tag_type !== typeFilter) return false;
    if (categoryFilter && (row.category || '') !== categoryFilter) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ tag_type: 'all', category: [], color: '' });
    setModalOpen(true);
  };

  const openEdit = (tag: OrganizationTag) => {
    setEditing(tag);
    form.setFieldsValue({
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
      tag_type: tag.tag_type || 'all',
      category: tag.category ? [tag.category] : [],
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const category =
      Array.isArray(values.category) ? (values.category[0]?.trim() || '') : (values.category?.trim() || '');
    try {
      if (editing) {
        await patchTag.mutateAsync({
          id: editing.id,
          name: values.name,
          slug: sanitizeTagSlugForSubmit(values.slug),
          color: values.color?.trim() || '',
          tag_type: values.tag_type || 'all',
          category,
        });
        message.success('Тег обновлён');
      } else {
        await createTag.mutateAsync({
          name: values.name,
          slug: sanitizeTagSlugForSubmit(values.slug),
          color: values.color?.trim() || '',
          tag_type: values.tag_type || 'all',
          category,
        });
        message.success('Тег создан');
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      const details = getAxiosErrorMessage(err);
      message.error(`${editing ? 'Не удалось обновить' : 'Не удалось создать'}: ${details}`);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Управление тегами
        </Typography.Title>
        <Typography.Text type="secondary" style={{ flex: '1 1 100%' }}>
          Общие теги для организаций, контактов, воронок, кампаний и лидов. Цвет: имя preset Ant Design или hex (#1677ff).
        </Typography.Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новый тег
        </Button>
      </Space>

      <Card>
        <Space style={{ marginBottom: 12 }} wrap>
          <Select
            allowClear
            style={{ width: 220 }}
            placeholder="Фильтр: тип"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: 'all', label: 'Все сущности' },
              { value: 'organizations', label: 'Организации' },
              { value: 'contacts', label: 'Контакты' },
              { value: 'funnels', label: 'Воронки' },
              { value: 'campaigns', label: 'Кампании' },
              { value: 'leads', label: 'Лиды' },
            ]}
          />
          <Select
            allowClear
            showSearch
            style={{ width: 260 }}
            placeholder="Фильтр: категория"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
        </Space>
        <Table<OrganizationTag>
          rowKey="id"
          loading={isLoading}
          dataSource={filteredRows}
          pagination={false}
          columns={[
            { title: 'Название', dataIndex: 'name', key: 'name' },
            {
              title: 'Тип',
              dataIndex: 'tag_type_display',
              key: 'tag_type',
              width: 180,
              render: (v: string | undefined, row) => v || row.tag_type,
            },
            {
              title: 'Категория',
              dataIndex: 'category',
              key: 'category',
              width: 200,
              render: (v: string) => v || <Typography.Text type="secondary">—</Typography.Text>,
            },
            { title: 'Код (slug)', dataIndex: 'slug', key: 'slug', width: 200 },
            {
              title: 'Цвет',
              dataIndex: 'color',
              key: 'color',
              width: 160,
              render: (v: string) => (
                <Space size={8}>
                  <Tag color={v || undefined}>{v || 'default'}</Tag>
                </Space>
              ),
            },
            {
              title: '',
              key: 'actions',
              width: 120,
              render: (_, r) => (
                <Space size="small">
                  <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteTag.isPending}
                    onClick={() => {
                      Modal.confirm({
                        title: `Удалить тег «${r.name}»?`,
                        content: 'Связь с объектами будет снята.',
                        okText: 'Удалить',
                        okType: 'danger',
                        cancelText: 'Отмена',
                        onOk: async () => {
                          try {
                            await deleteTag.mutateAsync(r.id);
                            message.success('Тег удалён');
                            refetch();
                          } catch {
                            message.error('Не удалось удалить');
                          }
                        },
                      });
                    }}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? 'Редактировать тег' : 'Новый тег'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        confirmLoading={createTag.isPending || patchTag.isPending}
      >
        <Form form={form} layout="vertical" initialValues={{ tag_type: 'all', category: [], color: '' }}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Например: VIP / Пилот / Госсектор" />
          </Form.Item>
          <Form.Item name="tag_type" label="Тип">
            <Select
              options={[
                { value: 'all', label: 'Все сущности' },
                { value: 'organizations', label: 'Организации' },
                { value: 'contacts', label: 'Контакты' },
                { value: 'funnels', label: 'Воронки' },
                { value: 'campaigns', label: 'Кампании' },
                { value: 'leads', label: 'Лиды' },
              ]}
            />
          </Form.Item>
          <Form.Item name="category" label="Категория (необязательно)">
            <Select
              mode="tags"
              maxCount={1}
              placeholder="Новая или существующая категория"
              options={categories.map((c) => ({ value: c, label: c }))}
              tokenSeparators={[',']}
            />
          </Form.Item>
          <Form.Item name="slug" label="Код (необязательно)">
            <Input placeholder="буквы и цифры, дефисы (кириллица или латиница); пусто — сгенерируется" />
          </Form.Item>
          <Form.Item name="color" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="Цвет">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <ColorPicker
                  value={selectedColor || undefined}
                  presets={[{ label: 'Базовые', colors: COLOR_PRESETS }]}
                  onChangeComplete={(value) => {
                    form.setFieldValue('color', value.toHexString());
                  }}
                />
                <Button
                  onClick={() => {
                    const name = form.getFieldValue('name') || '';
                    form.setFieldValue('color', pickAutoColor(name));
                  }}
                >
                  Автоцвет
                </Button>
                {selectedColor ? <Tag color={selectedColor}>{selectedColor}</Tag> : <Tag>default</Tag>}
              </Space>
              <Input
                value={selectedColor || ''}
                onChange={(e) => form.setFieldValue('color', e.target.value)}
                placeholder="Или введите вручную: blue, geekblue, #1677ff…"
              />
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

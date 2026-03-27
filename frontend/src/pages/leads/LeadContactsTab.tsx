import { useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Space, Switch, Radio, Typography, Spin, Tag, App, Tooltip,
} from 'antd';
import {
  EditOutlined, PlusOutlined, PhoneOutlined, MailOutlined, UserOutlined,
  StarFilled, StarOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useUpdateContact, useCreateContact, useUpdateLead } from '../../api/hooks';
import type { Contact } from '../../types';

type Props = {
  leadId: number;
  organizationId: number;
  organizationName: string;
  contacts: Contact[] | undefined;
  loading: boolean;
  primaryContactId: number | null;
};

export default function LeadContactsTab({
  leadId,
  organizationId,
  organizationName,
  contacts,
  loading,
  primaryContactId,
}: Props) {
  const { message } = App.useApp();
  const updateLead = useUpdateLead(leadId);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const updateContact = useUpdateContact();
  const createContact = useCreateContact();
  const contactType = Form.useWatch('type', form);
  const createType = Form.useWatch('type', createForm);

  const openEdit = (c: Contact) => {
    setEditing(c);
    form.setFieldsValue({
      type: c.type,
      comment: c.comment,
      first_name: c.first_name,
      last_name: c.last_name,
      middle_name: c.middle_name,
      position: c.position,
      phone: c.phone,
      email: c.email,
      messenger: c.messenger,
      is_manager: c.is_manager,
      department_name: c.department_name,
      current: c.current,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const values = await form.validateFields();
      await updateContact.mutateAsync({ id: editing.id, ...values });
      message.success('Контакт сохранён');
      setEditOpen(false);
      setEditing(null);
      form.resetFields();
    } catch {
      /* validation */
    }
  };

  const setPrimaryContact = async (contactId: number | null) => {
    try {
      await updateLead.mutateAsync({ primary_contact: contactId });
      message.success(
        contactId ? 'Основной контакт для организации сохранён в этом лиде' : 'Основной контакт снят',
      );
    } catch (err: any) {
      const d = err?.response?.data;
      const msg =
        (typeof d?.detail === 'string' && d.detail)
        || d?.primary_contact?.[0]
        || 'Не удалось сохранить';
      message.error(msg);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await createContact.mutateAsync({
        organization: organizationId,
        type: values.type || 'person',
        first_name: values.first_name || '',
        last_name: values.last_name || '',
        middle_name: values.middle_name || '',
        position: values.position || '',
        phone: values.phone || '',
        email: values.email || '',
        messenger: values.messenger || '',
        is_manager: values.is_manager || false,
        department_name: values.department_name || '',
        current: true,
      });
      message.success('Контакт создан');
      setCreateOpen(false);
      createForm.resetFields();
    } catch {
      /* validation */
    }
  };

  const columns: ColumnsType<Contact> = [
    {
      title: 'Осн.',
      key: 'primary',
      width: 52,
      align: 'center',
      render: (_, r) => {
        const isPrimary = primaryContactId === r.id;
        return (
          <Tooltip
            title={
              isPrimary
                ? 'Основной контакт по организации (нажмите, чтобы снять)'
                : 'Сделать основным для организации (будет только у одного лида)'
            }
          >
            <Button
              type="text"
              size="small"
              loading={updateLead.isPending}
              icon={isPrimary ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={() => setPrimaryContact(isPrimary ? null : r.id)}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Тип',
      dataIndex: 'type_display',
      key: 'type',
      width: 120,
      render: (_, r) => <Tag>{r.type_display}</Tag>,
    },
    {
      title: 'Имя / подразделение',
      key: 'name',
      render: (_, r) => (
        <Typography.Text>
          {r.type === 'department' ? (r.department_name || '—') : (r.full_name || '—')}
        </Typography.Text>
      ),
    },
    {
      title: 'Должность',
      dataIndex: 'position',
      key: 'position',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (v) => v || '—',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, r) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
          Изменить
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 32 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Typography.Text type="secondary">
            Организация: <strong>{organizationName}</strong>
          </Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4, fontSize: 12 }}>
            Один на организацию (в превью карточки и заказчиков). У другого лида метка снимется.
          </Typography.Paragraph>
        </div>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => {
            createForm.resetFields();
            createForm.setFieldsValue({ type: 'person' });
            setCreateOpen(true);
          }}
        >
          Добавить контакт
        </Button>
      </div>
      {!contacts?.length ? (
        <Typography.Text type="secondary">Контактов пока нет</Typography.Text>
      ) : (
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={contacts}
          pagination={{ pageSize: 15, hideOnSinglePage: true }}
        />
      )}

      <Modal
        title="Редактировать контакт"
        open={editOpen}
        onOk={handleSaveEdit}
        onCancel={() => { setEditOpen(false); setEditing(null); form.resetFields(); }}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={updateContact.isPending}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ type: 'person' }}>
          <Form.Item name="type" label="Тип контакта">
            <Radio.Group optionType="button" buttonStyle="solid" size="small">
              <Radio.Button value="person">Физ. лицо</Radio.Button>
              <Radio.Button value="department">Отдел</Radio.Button>
              <Radio.Button value="main">Основной</Radio.Button>
              <Radio.Button value="other">Другое</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {contactType === 'person' && (
            <>
              <Space style={{ width: '100%' }} align="start" wrap>
                <Form.Item name="last_name" label="Фамилия" rules={[{ required: true, message: 'Обязательно' }]}>
                  <Input prefix={<UserOutlined />} placeholder="Иванов" />
                </Form.Item>
                <Form.Item name="first_name" label="Имя" rules={[{ required: true, message: 'Обязательно' }]}>
                  <Input placeholder="Иван" />
                </Form.Item>
                <Form.Item name="middle_name" label="Отчество">
                  <Input placeholder="Иванович" />
                </Form.Item>
              </Space>
              <Form.Item name="position" label="Должность">
                <Input placeholder="Должность" />
              </Form.Item>
              <Space style={{ width: '100%' }} wrap>
                <Form.Item name="phone" label="Телефон">
                  <Input prefix={<PhoneOutlined />} placeholder="+7..." />
                </Form.Item>
                <Form.Item name="email" label="Email">
                  <Input prefix={<MailOutlined />} placeholder="email@example.com" />
                </Form.Item>
              </Space>
              <Form.Item name="messenger" label="Мессенджер">
                <Input placeholder="Telegram, WhatsApp и т.д." />
              </Form.Item>
              <Form.Item name="is_manager" label="Руководитель" valuePropName="checked">
                <Switch size="small" />
              </Form.Item>
            </>
          )}

          {contactType === 'department' && (
            <Form.Item name="department_name" label="Название отдела" rules={[{ required: true, message: 'Обязательно' }]}>
              <Input placeholder="Название отдела" />
            </Form.Item>
          )}

          {(contactType === 'main' || contactType === 'other') && (
            <Form.Item name="comment" label="Комментарий">
              <Input.TextArea rows={3} placeholder="Комментарий" />
            </Form.Item>
          )}

          <Form.Item name="current" label="Актуальный" valuePropName="checked">
            <Switch size="small" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Новый контакт"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createContact.isPending}
        width={520}
        destroyOnClose
      >
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Организация: <strong>{organizationName}</strong>
        </Typography.Text>
        <Form form={createForm} layout="vertical" initialValues={{ type: 'person' }}>
          <Form.Item name="type" label="Тип контакта">
            <Radio.Group optionType="button" buttonStyle="solid" size="small">
              <Radio.Button value="person">Физ. лицо</Radio.Button>
              <Radio.Button value="department">Отдел</Radio.Button>
              <Radio.Button value="main">Основной</Radio.Button>
              <Radio.Button value="other">Другое</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {createType === 'person' && (
            <>
              <Space style={{ width: '100%' }} align="start" wrap>
                <Form.Item name="last_name" label="Фамилия" rules={[{ required: true, message: 'Обязательно' }]}>
                  <Input prefix={<UserOutlined />} placeholder="Иванов" />
                </Form.Item>
                <Form.Item name="first_name" label="Имя" rules={[{ required: true, message: 'Обязательно' }]}>
                  <Input placeholder="Иван" />
                </Form.Item>
                <Form.Item name="middle_name" label="Отчество">
                  <Input placeholder="Иванович" />
                </Form.Item>
              </Space>
              <Form.Item name="position" label="Должность">
                <Input placeholder="Должность" />
              </Form.Item>
              <Space style={{ width: '100%' }} wrap>
                <Form.Item name="phone" label="Телефон">
                  <Input prefix={<PhoneOutlined />} placeholder="+7..." />
                </Form.Item>
                <Form.Item name="email" label="Email">
                  <Input prefix={<MailOutlined />} placeholder="email@example.com" />
                </Form.Item>
              </Space>
              <Form.Item name="messenger" label="Мессенджер">
                <Input placeholder="Telegram, WhatsApp и т.д." />
              </Form.Item>
              <Form.Item name="is_manager" label="Руководитель" valuePropName="checked">
                <Switch size="small" />
              </Form.Item>
            </>
          )}

          {createType === 'department' && (
            <Form.Item name="department_name" label="Название отдела" rules={[{ required: true, message: 'Обязательно' }]}>
              <Input placeholder="Отдел" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

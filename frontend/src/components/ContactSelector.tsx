import { useState, useMemo } from 'react';
import { Select, Button, Modal, Form, Input, Radio, Switch, Space, Typography, Tag, Divider } from 'antd';
import { PlusOutlined, UserOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import { useContactsByOrganization, useCreateContact } from '../api/hooks';
import type { Contact } from '../types';

interface Props {
  organizationId: number | null;
  organizationName: string;
  value?: number | null;
  onChange?: (contactId: number | null, contact?: Contact) => void;
  /** Also fill legacy text fields from selected contact */
  onContactDetails?: (details: {
    contact_person: string;
    contact_position: string;
    contact_phone: string;
    contact_email: string;
    contact_messenger: string;
  }) => void;
  size?: 'small' | 'middle' | 'large';
  style?: React.CSSProperties;
  placeholder?: string;
  allowClear?: boolean;
}

export default function ContactSelector({
  organizationId,
  organizationName,
  value,
  onChange,
  onContactDetails,
  size = 'middle',
  style,
  placeholder = 'Выберите контакт',
  allowClear = true,
}: Props) {
  const { data: contacts, isLoading } = useContactsByOrganization(organizationName || undefined);
  const createContact = useCreateContact();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const options = useMemo(() => {
    if (!contacts) return [];
    return contacts
      .filter(c => c.type === 'person')
      .map(c => ({
        value: c.id,
        label: `${c.full_name}${c.position ? ` — ${c.position}` : ''}`,
        contact: c,
      }));
  }, [contacts]);

  const allOptions = useMemo(() => {
    if (!contacts) return [];
    return contacts.map(c => ({
      value: c.id,
      label: c.type === 'person'
        ? `${c.full_name}${c.position ? ` — ${c.position}` : ''}`
        : c.type === 'department'
          ? `[Отдел] ${c.department_name}`
          : `[${c.type_display}]`,
      contact: c,
    }));
  }, [contacts]);

  const handleSelect = (contactId: number | null) => {
    onChange?.(contactId);
    if (contactId && onContactDetails) {
      const c = contacts?.find(c => c.id === contactId);
      if (c) {
        onContactDetails({
          contact_person: c.full_name,
          contact_position: c.position,
          contact_phone: c.phone,
          contact_email: c.email,
          contact_messenger: c.messenger,
        });
      }
    }
    if (!contactId && onContactDetails) {
      onContactDetails({
        contact_person: '',
        contact_position: '',
        contact_phone: '',
        contact_email: '',
        contact_messenger: '',
      });
    }
  };

  const handleCreateContact = async () => {
    try {
      const values = await form.validateFields();
      const data = {
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
      };
      const created = await createContact.mutateAsync(data);
      setModalOpen(false);
      form.resetFields();
      onChange?.(created.id, created);
      if (onContactDetails) {
        onContactDetails({
          contact_person: `${created.last_name} ${created.first_name} ${created.middle_name}`.trim(),
          contact_position: created.position,
          contact_phone: created.phone,
          contact_email: created.email,
          contact_messenger: created.messenger,
        });
      }
    } catch { /* validation */ }
  };

  const contactType = Form.useWatch('type', form);

  return (
    <>
      <Space.Compact style={style}>
        <Select
          size={size}
          style={{ flex: 1, minWidth: 200 }}
          placeholder={placeholder}
          value={value ?? undefined}
          onChange={(v) => handleSelect(v ?? null)}
          options={allOptions}
          loading={isLoading}
          allowClear={allowClear}
          showSearch
          optionFilterProp="label"
          notFoundContent={
            <div style={{ textAlign: 'center', padding: 8 }}>
              <Typography.Text type="secondary">Нет контактов</Typography.Text>
            </div>
          }
          dropdownRender={(menu) => (
            <>
              {menu}
              <Divider style={{ margin: '4px 0' }} />
              <div style={{ padding: '4px 8px' }}>
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => {
                    form.setFieldValue('type', 'person');
                    setModalOpen(true);
                  }}
                >
                  Добавить контакт
                </Button>
              </div>
            </>
          )}
        />
      </Space.Compact>

      <Modal
        title="Новый контакт"
        open={modalOpen}
        onOk={handleCreateContact}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createContact.isPending}
        width={520}
      >
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Организация: <strong>{organizationName}</strong>
        </Typography.Text>
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
              <Space style={{ width: '100%' }} align="start">
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
                <Input placeholder="Начальник отдела" />
              </Form.Item>
              <Space style={{ width: '100%' }}>
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
              <Input placeholder="Отдел цифровой трансформации" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

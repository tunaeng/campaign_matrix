import { useMemo, useState } from 'react';
import {
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Contact } from '../../types';
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useOrganizations,
  useOrganizationTags,
  useContactChangeLog,
  useImportContactsXlsx,
} from '../../api/hooks';
import EntityTagSelect, { renderTagChips } from '../../components/EntityTagSelect';
import FieldChangeTimeline from '../../components/FieldChangeTimeline';
import ImportHistoryPanel from '../../components/ImportHistoryPanel';
import { getAxiosErrorMessage } from '../../api/errorMessage';
import client from '../../api/client';
import { formatPhoneWithExtension } from '../../utils/formatPhoneWithExtension';

const CONTACT_TYPE_OPTIONS = [
  { value: 'person', label: 'Физическое лицо' },
  { value: 'department', label: 'Отдел' },
  { value: 'main', label: 'Основной' },
  { value: 'other', label: 'Другое' },
];

const ORG_TYPE_OPTIONS = [
  { value: 'roiv', label: 'РОИВ' },
  { value: 'federal', label: 'Федеральная' },
  { value: 'municipal', label: 'Муниципальная' },
  { value: 'private', label: 'Коммерческая' },
  { value: 'company_branch', label: 'Подразделение (без ИНН)' },
  { value: 'other', label: 'Другое' },
];

export default function ContactsRegistryPage() {
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [organization, setOrganization] = useState<number | undefined>();
  const [type, setType] = useState<string | undefined>();
  const [current, setCurrent] = useState<boolean | undefined>();
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [form] = Form.useForm();
  const [importOpen, setImportOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [importForm] = Form.useForm();
  const [importFiles, setImportFiles] = useState<UploadFile[]>([]);

  const contactsQuery = useContacts({
    page,
    page_size: pageSize,
    search: search || undefined,
    organization,
    type,
    current,
    tags: tagFilter.length ? tagFilter.join(',') : undefined,
  });
  const { data: organizationsData } = useOrganizations({ page_size: 500 });
  const { data: tagsCatalog } = useOrganizationTags({ page_size: 500, tag_type: 'contacts' });
  const { data: orgTagsCatalog } = useOrganizationTags({ page_size: 500, tag_type: 'organizations' });
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const importContactsXlsx = useImportContactsXlsx();
  const changeLogQuery = useContactChangeLog(historyContact?.id, { page_size: 100 });

  const rows = contactsQuery.data?.results || [];
  const total = contactsQuery.data?.count || 0;
  const organizationOptions = useMemo(() => {
    const base = (organizationsData?.results || []).map((o) => ({
      value: o.id,
      label: o.short_name || o.name,
    }));
    if (editing?.organization && !base.some((opt) => opt.value === editing.organization)) {
      base.push({
        value: editing.organization,
        label: editing.organization_name || `ID ${editing.organization}`,
      });
    }
    return base;
  }, [organizationsData, editing]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'person',
      current: true,
      is_manager: false,
      tags: [],
    });
    setOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    form.setFieldsValue({
      ...contact,
      tags: contact.tags || [],
    });
    setOpen(true);
  };

  const openHistory = (contact: Contact) => {
    setHistoryContact(contact);
    setHistoryOpen(true);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateContact.mutateAsync({ id: editing.id, ...values });
        message.success('Контакт обновлён');
      } else {
        await createContact.mutateAsync(values);
        message.success('Контакт создан');
      }
      setOpen(false);
      contactsQuery.refetch();
    } catch {
      // form/api errors shown by antd
    }
  };

  const openImport = () => {
    setImportFiles([]);
    importForm.resetFields();
    importForm.setFieldsValue({
      default_org_type: 'other',
      default_contact_type: 'person',
      create_missing_organizations: true,
      organization_tag_ids: [],
      contact_tag_ids: [],
    });
    setImportOpen(true);
  };

  const downloadContactsImportTemplate = async () => {
    try {
      const res = await client.get('/contacts/import-xlsx-template/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts_import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      message.error(`Не удалось скачать шаблон: ${getAxiosErrorMessage(err)}`);
    }
  };

  const submitImport = async () => {
    try {
      const values = await importForm.validateFields();
      const file = importFiles[0]?.originFileObj;
      if (!file) {
        message.error('Выберите .xlsx файл для импорта');
        return;
      }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('default_org_type', values.default_org_type || 'other');
      fd.append('default_contact_type', values.default_contact_type || 'person');
      fd.append('create_missing_organizations', values.create_missing_organizations ? 'true' : 'false');
      fd.append('organization_tag_ids', (values.organization_tag_ids || []).join(','));
      fd.append('contact_tag_ids', (values.contact_tag_ids || []).join(','));
      fd.append('source', 'bulk');

      const result = await importContactsXlsx.mutateAsync(fd);
      message.success(`Импорт завершён: создано ${result.created}, обновлено ${result.updated}, пропущено ${result.skipped}`);
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        Modal.info({
          title: 'Импорт завершён с замечаниями',
          width: 900,
          content: (
            <div style={{ maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {result.errors.slice(0, 30).join('\n')}
            </div>
          ),
        });
      }
      setImportOpen(false);
      contactsQuery.refetch();
    } catch (err) {
      message.error(`Не удалось импортировать контакты: ${getAxiosErrorMessage(err)}`);
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          База контактов
        </Typography.Title>
        <Space>
          <Button onClick={openImport}>Импорт из Excel</Button>
          <Button onClick={() => setImportHistoryOpen(true)}>Загруженные файлы</Button>
          <Button type="primary" onClick={openCreate}>
            Добавить контакт
          </Button>
        </Space>
      </div>

      <Space wrap size="middle" style={{ marginBottom: 12 }}>
        <Input.Search
          allowClear
          style={{ width: 260 }}
          placeholder="Поиск: ФИО, должность, отдел"
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
        <Select
          allowClear
          style={{ width: 240 }}
          placeholder="Организация"
          value={organization}
          onChange={(v) => {
            setOrganization(v);
            setPage(1);
          }}
          options={organizationOptions}
        />
        <Select
          allowClear
          style={{ width: 200 }}
          placeholder="Тип контакта"
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={CONTACT_TYPE_OPTIONS}
        />
        <Select
          allowClear
          style={{ width: 160 }}
          placeholder="Актуальность"
          value={current}
          onChange={(v) => {
            setCurrent(v);
            setPage(1);
          }}
          options={[
            { value: true, label: 'Актуальные' },
            { value: false, label: 'Неактуальные' },
          ]}
        />
        <EntityTagSelect
          availableTags={tagsCatalog?.results}
          value={tagFilter}
          onChange={(v) => {
            setTagFilter(v);
            setPage(1);
          }}
          placeholder="Фильтр по тегам"
          style={{ width: 280 }}
        />
      </Space>

      {total > 0 && (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Показано {rows.length} из {total} контактов
        </Typography.Text>
      )}

      <Table<Contact>
        rowKey="id"
        loading={contactsQuery.isLoading || contactsQuery.isFetching}
        dataSource={rows}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [25, 50, 100],
          showTotal: (t, range) => `${range[0]}-${range[1]} из ${t}`,
          onChange: (nextPage, nextSize) => {
            if (nextSize && nextSize !== pageSize) {
              setPageSize(nextSize);
              setPage(1);
              return;
            }
            setPage(nextPage);
          },
          onShowSizeChange: (_, nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          },
        }}
        columns={[
          {
            title: 'ФИО / отдел',
            key: 'name',
            render: (_, row) => row.full_name || row.department_name || '—',
          },
          { title: 'Организация', dataIndex: 'organization_name', key: 'organization', width: 260 },
          { title: 'Тип', dataIndex: 'type_display', key: 'type', width: 150 },
          { title: 'Должность', dataIndex: 'position', key: 'position', width: 220, render: (v) => v || '—' },
          {
            title: 'Контакты',
            key: 'contacts',
            width: 260,
            render: (_, row) => (
              <Space direction="vertical" size={0}>
                <Typography.Text>
                  {formatPhoneWithExtension(row.phone, row.phone_extension) || '—'}
                </Typography.Text>
                <Typography.Text type="secondary">{row.email || '—'}</Typography.Text>
                <Typography.Text type="secondary">{row.messenger || '—'}</Typography.Text>
              </Space>
            ),
          },
          {
            title: 'Статус',
            key: 'status',
            width: 130,
            render: (_, row) => (
              row.current ? <Tag color="green">Актуален</Tag> : <Tag>Неактуален</Tag>
            ),
          },
          {
            title: 'Теги',
            key: 'tags',
            width: 220,
            render: (_, row) => renderTagChips(row.tag_names, tagsCatalog?.results, row.tags) || '—',
          },
          {
            title: '',
            key: 'actions',
            width: 160,
            render: (_, row) => (
              <Space size="small">
                <Button size="small" onClick={() => openEdit(row)}>
                  Изменить
                </Button>
                <Button size="small" onClick={() => openHistory(row)}>
                  История
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Редактирование контакта' : 'Новый контакт'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        width={760}
        okButtonProps={{ loading: createContact.isPending || updateContact.isPending }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="organization" label="Организация" rules={[{ required: true, message: 'Выберите организацию' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={organizationOptions}
            />
          </Form.Item>
          <Space size={12} style={{ width: '100%' }} align="start">
            <Form.Item name="type" label="Тип" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select options={CONTACT_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="position" label="Должность" style={{ flex: 2 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size={12} style={{ width: '100%' }} align="start">
            <Form.Item name="last_name" label="Фамилия" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="first_name" label="Имя" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="middle_name" label="Отчество" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="department_name" label="Название отдела">
            <Input />
          </Form.Item>
          <Space size={12} style={{ width: '100%' }} align="start">
            <Form.Item name="phone" label="Телефон" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="phone_extension" label="Добавочный" style={{ flex: 0.6 }}>
              <Input placeholder="Напр. 1234" />
            </Form.Item>
            <Form.Item name="email" label="Email" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="messenger" label="Мессенджер" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="tags" label="Теги">
            <EntityTagSelect availableTags={tagsCatalog?.results} style={{ width: '100%' }} />
          </Form.Item>
          <Space size={24}>
            <Form.Item name="current" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>Актуальный контакт</Checkbox>
            </Form.Item>
            <Form.Item name="is_manager" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>Руководитель</Checkbox>
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={historyContact ? `История изменений: ${historyContact.full_name || historyContact.department_name || 'Контакт'}` : 'История изменений'}
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={null}
        width={860}
      >
        <FieldChangeTimeline
          loading={changeLogQuery.isLoading}
          items={changeLogQuery.data?.results || []}
          emptyText="По контакту пока нет записей аудита"
        />
      </Modal>

      <Modal
        title="Загруженные файлы"
        open={importHistoryOpen}
        onCancel={() => setImportHistoryOpen(false)}
        footer={null}
        width={980}
      >
        <ImportHistoryPanel entityType="contacts" title="История импортов" />
      </Modal>

      <Modal
        title="Импорт контактов из Excel"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={submitImport}
        okText="Импортировать"
        width={860}
        confirmLoading={importContactsXlsx.isPending}
      >
        <Form form={importForm} layout="vertical">
          <Form.Item label="Файл .xlsx" required>
            <Space align="start">
              <Upload
                maxCount={1}
                accept=".xlsx"
                fileList={importFiles}
                beforeUpload={(file) => {
                  setImportFiles([
                    {
                      uid: `${Date.now()}-${file.name}`,
                      name: file.name,
                      status: 'done',
                      originFileObj: file,
                    },
                  ]);
                  return false;
                }}
                onRemove={() => {
                  setImportFiles([]);
                }}
              >
                <Button>Выбрать файл</Button>
              </Upload>
              <Button type="link" onClick={downloadContactsImportTemplate} style={{ paddingLeft: 0 }}>
                Скачать пример таблицы
              </Button>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Колонки: организация (ИНН или название), краткое наименование (для автосоздания по ИНН), ФИО, должность,
              телефон (в той же ячейке можно указать добавочный: «доб. 123»), отдельная колонка «Добавочный», email, регион
              и др.; опционально — тип организации для строки, теги организации и теги контакта (имена через запятую, как в
              справочнике тегов). Синонимы заголовков поддерживаются.
            </Typography.Text>
          </Form.Item>

          <Space style={{ width: '100%' }} size={12} align="start">
            <Form.Item name="default_org_type" label="Тип организаций для импорта" style={{ flex: 1 }}>
              <Select options={ORG_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="default_contact_type" label="Тип контактов по умолчанию" style={{ flex: 1 }}>
              <Select options={CONTACT_TYPE_OPTIONS} />
            </Form.Item>
          </Space>

          <Form.Item name="create_missing_organizations" valuePropName="checked">
            <Checkbox>Создавать отсутствующие организации, если в колонке «Организация» указан ИНН</Checkbox>
          </Form.Item>

          <Form.Item name="organization_tag_ids" label="Теги для организаций (добавляются при импорте)">
            <EntityTagSelect availableTags={orgTagsCatalog?.results} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="contact_tag_ids" label="Теги для контактов (добавляются при импорте)">
            <EntityTagSelect availableTags={tagsCatalog?.results} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

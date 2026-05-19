import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { ColumnsType } from 'antd/es/table';
import type { SelectProps } from 'antd/es/select';
import client from '../../api/client';
import {
  useOrganizations,
  useOrganizationTags,
  useProjects,
  useRegions,
  useCreateOrganization,
  useUpdateOrganization,
  useOrganizationChangeLog,
  useImportOrganizationsXlsx,
} from '../../api/hooks';
import { getAxiosErrorMessage } from '../../api/errorMessage';
import type { Organization } from '../../types';
import EntityTagSelect, { renderTagChips } from '../../components/EntityTagSelect';
import FieldChangeTimeline from '../../components/FieldChangeTimeline';

const ORG_TYPE_OPTIONS = [
  { value: 'roiv', label: 'РОИВ' },
  { value: 'federal', label: 'Федеральная' },
  { value: 'municipal', label: 'Муниципальная' },
  { value: 'private', label: 'Коммерческая' },
  { value: 'company_branch', label: 'Подразделение (без ИНН)' },
  { value: 'other', label: 'Другое' },
];

/** Минимальная длина запроса: для ИНН — с 5 цифр, для текста — с 2 символов (меньше — шум на сервере). */
function shouldRunParentOrgSearchQuery(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^\d+$/.test(t)) return t.length >= 5;
  return t.length >= 2;
}

export default function OrganizationRegistryPage() {
  const { message } = App.useApp();
  const progressCloseRef = useRef<(() => void) | null>(null);
  const closeProgressToast = () => {
    progressCloseRef.current?.();
    progressCloseRef.current = null;
  };
  const setProgressToast = (text: string) => {
    closeProgressToast();
    progressCloseRef.current = message.loading(text, 0);
  };

  const [bulkActionBusy, setBulkActionBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [orgTypeFilter, setOrgTypeFilter] = useState<string | undefined>();
  const [project, setProject] = useState<number | undefined>();
  const [role, setRole] = useState<string | undefined>();
  const [tags, setTags] = useState<number[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [open, setOpen] = useState(false);
  const [bulkAddTagsOpen, setBulkAddTagsOpen] = useState(false);
  const [bulkTypeOpen, setBulkTypeOpen] = useState(false);
  const [form] = Form.useForm();
  const watchedOrgType = Form.useWatch('org_type', form);
  const isCompanyBranch = watchedOrgType === 'company_branch';
  const [bulkTagForm] = Form.useForm<{ tagIds: number[] }>();
  const [bulkTypeForm] = Form.useForm<{ org_type: string }>();
  const [importOpen, setImportOpen] = useState(false);
  const [importForm] = Form.useForm();
  const [importFiles, setImportFiles] = useState<UploadFile[]>([]);
  const [parentSearchOptions, setParentSearchOptions] = useState<{ value: number; label: string }[]>([]);
  const [parentSearchLoading, setParentSearchLoading] = useState(false);
  const [parentPinnedOptions, setParentPinnedOptions] = useState<{ value: number; label: string }[]>([]);
  const parentSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      org_type: orgTypeFilter || undefined,
      project,
      role,
      tags: tags.length ? tags.join(',') : undefined,
    }),
    [search, orgTypeFilter, project, role, tags],
  );

  const { data, isLoading, refetch } = useOrganizations(params);
  const { data: tagsData } = useOrganizationTags({ page_size: 500, tag_type: 'organizations' });
  const { data: regionsData } = useRegions({ page_size: 500 });
  const { data: projectsData } = useProjects({ page_size: 500 });
  const createOrganization = useCreateOrganization();
  const updateOrganization = useUpdateOrganization();
  const organizationChangeLog = useOrganizationChangeLog(editing?.id, { page_size: 100 });
  const importOrganizationsXlsx = useImportOrganizationsXlsx();

  const organizations = data?.results || [];
  const totalCount = data?.count ?? organizations.length;

  const orgById = useMemo(() => {
    const m = new Map<number, Organization>();
    for (const o of organizations) m.set(o.id, o);
    return m;
  }, [organizations]);

  const mergedParentOrgOptions = useMemo(() => {
    const seen = new Set<number>();
    const out: { value: number; label: string }[] = [];
    for (const o of parentPinnedOptions) {
      if (seen.has(o.value)) continue;
      seen.add(o.value);
      out.push(o);
    }
    for (const o of parentSearchOptions) {
      if (seen.has(o.value)) continue;
      if (editing?.id && o.value === editing.id) continue;
      seen.add(o.value);
      out.push(o);
    }
    return out;
  }, [parentPinnedOptions, parentSearchOptions, editing?.id]);

  const runParentOrgSearch = useCallback(
    async (q: string) => {
      if (!shouldRunParentOrgSearchQuery(q)) {
        setParentSearchOptions([]);
        return;
      }
      setParentSearchLoading(true);
      try {
        const res = await client.get('/organizations/', {
          params: { search: q.trim(), page_size: 100, ordering: 'name' },
        });
        const rows = (res.data?.results || []).filter(
          (o: Organization) =>
            o.id !== editing?.id && o.inn != null && String(o.inn).trim() !== '',
        );
        setParentSearchOptions(
          rows.map((o: Organization) => ({
            value: o.id,
            label: `${o.short_name || o.name} · ИНН ${o.inn}`,
          })),
        );
      } catch {
        setParentSearchOptions([]);
      } finally {
        setParentSearchLoading(false);
      }
    },
    [editing?.id],
  );

  const scheduleParentOrgSearch = useCallback(
    (q: string) => {
      if (parentSearchTimerRef.current) clearTimeout(parentSearchTimerRef.current);
      parentSearchTimerRef.current = setTimeout(() => runParentOrgSearch(q), 320);
    },
    [runParentOrgSearch],
  );

  useEffect(() => {
    return () => {
      if (parentSearchTimerRef.current) clearTimeout(parentSearchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open || !isCompanyBranch) {
      setParentPinnedOptions([]);
      setParentSearchOptions([]);
      return;
    }
    if (!editing?.id) {
      return;
    }
    const pid = editing.parent_organization;
    if (!pid) {
      setParentPinnedOptions([]);
      return;
    }
    const pname = editing.parent_organization_name;
    if (pname) {
      setParentPinnedOptions([{ value: pid, label: `${pname} (головная)` }]);
      return;
    }
    let cancelled = false;
    client
      .get(`/organizations/${pid}/`)
      .then((r) => {
        if (cancelled) return;
        const o = r.data as Organization;
        if (o?.id && o.inn) {
          setParentPinnedOptions([
            { value: o.id, label: `${o.short_name || o.name} · ИНН ${o.inn}` },
          ]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, isCompanyBranch, editing?.id, editing?.parent_organization, editing?.parent_organization_name]);

  const handleParentOrgChange: SelectProps['onChange'] = (v, opt) => {
    if (v == null || v === undefined) {
      setParentPinnedOptions([]);
      return;
    }
    const info = Array.isArray(opt) ? opt[0] : opt;
    const label =
      info && typeof info === 'object' && 'label' in info && info.label != null
        ? String(info.label)
        : String(v);
    setParentPinnedOptions([{ value: Number(v), label }]);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ org_type: 'other', tags: [], region: undefined, parent_organization: undefined });
    setParentSearchOptions([]);
    setParentPinnedOptions([]);
    setOpen(true);
  };

  const openEdit = (row: Organization) => {
    setEditing(row);
    setParentSearchOptions([]);
    form.setFieldsValue({
      ...row,
      tags: row.tags || [],
      org_type: row.org_type || 'other',
      region: row.region ?? undefined,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateOrganization.mutateAsync({ id: editing.id, ...values });
        message.success('Организация обновлена');
      } else {
        await createOrganization.mutateAsync(values);
        message.success('Организация создана');
      }
      setOpen(false);
      setParentSearchOptions([]);
      setParentPinnedOptions([]);
      await refetch();
    } catch {
      // validation / api handled by form
    }
  };

  const openImport = () => {
    setImportFiles([]);
    importForm.resetFields();
    importForm.setFieldsValue({
      default_org_type: 'other',
      tag_ids: [],
      update_existing: true,
    });
    setImportOpen(true);
  };

  const downloadOrganizationsImportTemplate = async () => {
    try {
      const res = await client.get('/organizations/import-xlsx-template/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'organizations_import_template.xlsx';
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
      fd.append('tag_ids', (values.tag_ids || []).join(','));
      fd.append('update_existing', values.update_existing ? 'true' : 'false');
      fd.append('source', 'bulk');
      const result = await importOrganizationsXlsx.mutateAsync(fd);
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
      await refetch();
    } catch (err) {
      message.error(`Не удалось импортировать организации: ${getAxiosErrorMessage(err)}`);
    }
  };

  const clearSelection = () => setSelectedRowKeys([]);

  const runBulkPatches = async (
    ids: number[],
    patcher: (id: number, org: Organization | undefined) => Promise<void>,
    labelDone: string,
  ): Promise<boolean> => {
    if (bulkActionBusy) return false;
    setBulkActionBusy(true);
    setProgressToast(
      ids.length <= 1
        ? `${labelDone}: отправка запроса… Подождите.`
        : `${labelDone}: 0 из ${ids.length}. Не закрывайте страницу — операция занимает время.`,
    );

    let ok = 0;
    let fail = 0;
    const errors: string[] = [];
    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]!;
        const org = orgById.get(id);
        const shortLabel =
          (org?.short_name?.trim() || org?.name?.slice(0, 36) || `ID ${String(id)}`).trim() || String(id);
        setProgressToast(
          `${labelDone}: шаг ${i + 1} из ${ids.length} · ${shortLabel}`,
        );
        try {
          await patcher(id, org);
          ok += 1;
        } catch (err) {
          fail += 1;
          errors.push(`${id}: ${getAxiosErrorMessage(err)}`);
        }
      }
      setProgressToast('Обновление таблицы…');
      await refetch();
      clearSelection();
      if (fail === 0) {
        message.success(`${labelDone}: готово, обработано ${ok}.`, 5);
        return true;
      }
      message.warning({
        content: `${labelDone}: выполнено с ошибками — успешно ${ok}, ошибок ${fail}. Подробности в консоли браузера (F12).`,
        duration: 10,
      });
      console.error(errors.join('\n'));
      return false;
    } catch (err) {
      message.error(`Операция прервана: ${getAxiosErrorMessage(err)}`);
      return false;
    } finally {
      closeProgressToast();
      setBulkActionBusy(false);
    }
  };

  const submitBulkAddTags = async () => {
    try {
      const vals = await bulkTagForm.validateFields();
      const toAdd = vals.tagIds ?? [];
      await runBulkPatches(
        selectedRowKeys,
        async (id, org) => {
          const merged = [...new Set([...(org?.tags ?? []), ...toAdd])];
          await client.patch(`/organizations/${id}/`, { tags: merged }, { params: { source: 'bulk' } });
        },
        'Теги добавлены',
      );
      setBulkAddTagsOpen(false);
      bulkTagForm.resetFields();
    } catch {
      //
    }
  };

  const submitBulkType = async () => {
    try {
      const vals = await bulkTypeForm.validateFields();
      const orgType = vals.org_type;
      await runBulkPatches(
        selectedRowKeys,
        async (id) => {
          await client.patch(`/organizations/${id}/`, { org_type: orgType }, { params: { source: 'bulk' } });
        },
        'Тип организации изменён',
      );
      setBulkTypeOpen(false);
      bulkTypeForm.resetFields();
    } catch {
      //
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedRowKeys];
    await runBulkPatches(
      ids,
      async (id) => {
        await client.delete(`/organizations/${id}/`);
      },
      'Организации удалены',
    );
  };

  const columns: ColumnsType<Organization> = [
    { title: 'Название', dataIndex: 'name', key: 'name' },
    {
      title: 'ИНН',
      dataIndex: 'inn',
      key: 'inn',
      width: 160,
      render: (_: string | null | undefined, row: Organization) => {
        if (row.org_type === 'company_branch') {
          const ps = row.parent_organization_short_name?.trim();
          return ps || '—';
        }
        const v = row.inn;
        return v?.trim() || '—';
      },
    },
    { title: 'Регион', dataIndex: 'region_name', key: 'region', width: 180, render: (v) => v || '—' },
    { title: 'Тип', dataIndex: 'org_type_display', key: 'type', width: 180 },
    {
      title: 'Теги',
      key: 'tags',
      render: (_: unknown, row: Organization) => {
        const chips = renderTagChips(row.tag_names, tagsData?.results, row.tags);
        if (!chips) {
          return <Typography.Text type="secondary">—</Typography.Text>;
        }
        return <Space wrap size={4}>{chips}</Space>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_: unknown, row: Organization) => (
        <Button size="small" disabled={bulkActionBusy} onClick={() => openEdit(row)}>
          Изменить
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          База организаций
        </Typography.Title>
        <Space>
          <Button onClick={openImport}>Импорт из Excel</Button>
          <Button type="primary" onClick={openCreate}>
            Добавить организацию
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 12 }} wrap size="middle">
        <Input.Search
          placeholder="Поиск по названию / ИНН"
          allowClear
          style={{ width: 280 }}
          onSearch={setSearch}
        />
        <Select
          allowClear
          placeholder="Тип организации"
          style={{ width: 220 }}
          value={orgTypeFilter}
          onChange={(v) => setOrgTypeFilter(v)}
          options={ORG_TYPE_OPTIONS}
        />
        <Select
          allowClear
          placeholder="Проект"
          style={{ width: 220 }}
          value={project}
          onChange={(v) => setProject(v)}
          options={(projectsData?.results || []).map((p) => ({
            value: p.id,
            label: `${p.name} (${p.year})`,
          }))}
        />
        <Select
          allowClear
          placeholder="Роль в проекте"
          style={{ width: 220 }}
          value={role}
          onChange={(v) => setRole(v)}
          options={[
            { value: 'customer', label: 'Заказчик' },
            { value: 'federal_operator', label: 'Федеральный оператор' },
            { value: 'participant', label: 'Участник' },
            { value: 'contractor', label: 'Подрядчик' },
            { value: 'implementer', label: 'Исполнитель' },
          ]}
        />
        <Select
          mode="multiple"
          allowClear
          placeholder="Теги"
          style={{ width: 280 }}
          value={tags}
          onChange={(v) => setTags(v)}
          options={(tagsData?.results || []).map((t) => ({
            value: t.id,
            label: t.name,
          }))}
        />
      </Space>

      {selectedRowKeys.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={
            <Space wrap align="center">
              {bulkActionBusy && <Spin size="small" />}
              <Typography.Text strong>
                Выбрано: {selectedRowKeys.length}
                {totalCount > organizations.length
                  ? ` (из ${organizations.length} загруженных при ~${totalCount} по фильтру)`
                  : ''}
              </Typography.Text>
            </Space>
          }
          description={
            bulkActionBusy ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Ждём ответ сервера. Прогресс обновляется во всплывающих уведомлениях над экраном; при большом числе строк
                это может занять заметное время.
              </Typography.Text>
            ) : undefined
          }
          action={
            <Space wrap>
              <Button size="small" disabled={bulkActionBusy} onClick={() => setBulkAddTagsOpen(true)}>
                Добавить тег…
              </Button>
              <Button size="small" disabled={bulkActionBusy} onClick={() => setBulkTypeOpen(true)}>
                Изменить тип…
              </Button>
              <Popconfirm
                title={`Удалить ${selectedRowKeys.length} организаций?`}
                description="Удалятся связанные контакты, лиды и участие в кампаниях для этих организаций."
                okText="Удалить"
                cancelText="Отмена"
                okButtonProps={{ danger: true, disabled: bulkActionBusy }}
                disabled={bulkActionBusy}
                onConfirm={handleBulkDelete}
              >
                <Button size="small" danger disabled={bulkActionBusy}>
                  Удалить
                </Button>
              </Popconfirm>
              <Button size="small" type="link" disabled={bulkActionBusy} onClick={clearSelection}>
                Снять выбор
              </Button>
            </Space>
          }
        />
      )}

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        В списке до 500 строк по фильтру. В шапке таблицы можно выделить строки текущей страницы или все в списке. При
        массовом действии смотрите индикатор загрузки в таблице и текст прогресса в уведомлении над страницей.
      </Typography.Text>

      <Table
        rowKey="id"
        loading={isLoading || bulkActionBusy}
        dataSource={organizations}
        pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: [25, 50, 100] }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => {
            if (bulkActionBusy) return;
            setSelectedRowKeys(keys as number[]);
          },
          getCheckboxProps: () => ({
            disabled: bulkActionBusy,
          }),
          selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
          columnWidth: 48,
        }}
        columns={columns}
      />

      <Modal
        title={editing ? 'Редактирование организации' : 'Новая организация'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setParentSearchOptions([]);
          setParentPinnedOptions([]);
        }}
        onOk={handleSave}
        okButtonProps={{ loading: createOrganization.isPending || updateOrganization.isPending || organizationChangeLog.isFetching }}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Название" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Краткое название" name="short_name">
            <Input />
          </Form.Item>
          <Form.Item label="Тип организации" name="org_type" rules={[{ required: true }]}>
            <Select
              options={ORG_TYPE_OPTIONS}
              onChange={(v) => {
                if (v === 'company_branch') {
                  form.setFieldsValue({ inn: undefined });
                } else {
                  form.setFieldsValue({ parent_organization: undefined });
                }
              }}
            />
          </Form.Item>
          {isCompanyBranch && (
            <Form.Item
              label="Головная организация"
              name="parent_organization"
              rules={[{ required: true, message: 'Выберите юрлицо с ИНН' }]}
              extra="Поиск по всей базе: введите ИНН (не меньше 5 цифр) или часть названия (от 2 символов), затем выберите строку из списка."
            >
              <Select
                allowClear
                showSearch
                filterOption={false}
                loading={parentSearchLoading}
                onSearch={scheduleParentOrgSearch}
                onChange={handleParentOrgChange}
                placeholder="Например: 7708503727 или РЖД"
                optionFilterProp="label"
                options={mergedParentOrgOptions}
                notFoundContent={
                  parentSearchLoading ? <Spin size="small" /> : 'Введите ИНН или название для поиска'
                }
              />
            </Form.Item>
          )}
          <Form.Item
            label="ИНН"
            name="inn"
            rules={[
              {
                validator: async (_, value) => {
                  if (isCompanyBranch) return Promise.resolve();
                  const s = (value ?? '').toString().replace(/\D/g, '');
                  if (!s) return Promise.reject(new Error('Укажите ИНН'));
                  if (s.length !== 10 && s.length !== 12) {
                    return Promise.reject(new Error('ИНН: 10 или 12 цифр'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input maxLength={12} disabled={isCompanyBranch} placeholder={isCompanyBranch ? 'Не требуется' : undefined} />
          </Form.Item>
          <Form.Item label="Регион" name="region">
            <Select
              allowClear
              showSearch
              placeholder="Выберите регион"
              optionFilterProp="label"
              options={(regionsData?.results || []).map((r) => ({
                value: r.id,
                label: r.name,
              }))}
            />
          </Form.Item>
          <Form.Item label="Описание" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Теги" name="tags">
            <EntityTagSelect
              placeholder="Выберите теги"
              availableTags={tagsData?.results}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
        {editing && (
          <div style={{ marginTop: 16 }}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              История изменений организации
            </Typography.Title>
            <FieldChangeTimeline
              loading={organizationChangeLog.isLoading}
              items={organizationChangeLog.data?.results || []}
              emptyText="По этой организации ещё нет записей в журнале"
            />
          </div>
        )}
      </Modal>

      <Modal
        title={`Добавить тег к ${selectedRowKeys.length} организациям`}
        open={bulkAddTagsOpen}
        onCancel={() => {
          if (bulkActionBusy) return;
          setBulkAddTagsOpen(false);
          bulkTagForm.resetFields();
        }}
        onOk={submitBulkAddTags}
        okText="Добавить"
        confirmLoading={bulkActionBusy}
        maskClosable={!bulkActionBusy}
        keyboard={!bulkActionBusy}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Выбранные теги будут добавлены к уже существующим у каждой организации (дубликаты не создаются).
        </Typography.Paragraph>
        <Form form={bulkTagForm} layout="vertical">
          <Form.Item
            name="tagIds"
            label="Теги"
            rules={[
              {
                validator: (_, v) =>
                  Array.isArray(v) && v.length > 0 ? Promise.resolve() : Promise.reject(new Error('Выберите теги')),
              },
            ]}
          >
            <EntityTagSelect placeholder="Выберите теги" availableTags={tagsData?.results} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Изменить тип (${selectedRowKeys.length} организаций)`}
        open={bulkTypeOpen}
        onCancel={() => {
          if (bulkActionBusy) return;
          setBulkTypeOpen(false);
          bulkTypeForm.resetFields();
        }}
        onOk={submitBulkType}
        okText="Применить"
        confirmLoading={bulkActionBusy}
        maskClosable={!bulkActionBusy}
        keyboard={!bulkActionBusy}
      >
        <Form form={bulkTypeForm} layout="vertical">
          <Form.Item name="org_type" label="Новый тип" rules={[{ required: true, message: 'Выберите тип' }]}>
            <Select options={ORG_TYPE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Импорт организаций из Excel"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={submitImport}
        okText="Импортировать"
        width={820}
        confirmLoading={importOrganizationsXlsx.isPending}
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
                onRemove={() => setImportFiles([])}
              >
                <Button>Выбрать файл</Button>
              </Upload>
              <Button type="link" onClick={downloadOrganizationsImportTemplate} style={{ paddingLeft: 0 }}>
                Скачать пример таблицы
              </Button>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Колонки: наименование, краткое наименование, ИНН, головная организация (ИНН или название юрлица — только
              для типа «подразделение»), регион, описание; опционально — тип организации (код или подпись, напр.
              «коммерческая», «подразделение»), теги через запятую. Синонимы заголовков поддерживаются; общие теги из
              формы ниже добавляются ко всем строкам.
            </Typography.Text>
          </Form.Item>
          <Form.Item name="default_org_type" label="Тип организаций по умолчанию (если в строке не указан)">
            <Select options={ORG_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="tag_ids" label="Теги для всех импортируемых строк (плюс теги из колонки файла)">
            <EntityTagSelect availableTags={tagsData?.results} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="update_existing" valuePropName="checked">
            <Checkbox>Обновлять найденные организации (по ИНН/названию)</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Space,
  Typography,
} from 'antd';
import ResponsiveTable from '../../components/responsive/ResponsiveTable';
import { DeleteOutlined, EditOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { SelectProps } from 'antd/es/select';
import {
  useCreateProject,
  useCreateProjectMembership,
  useDeleteProject,
  useDeleteProjectMembership,
  useProjectMemberships,
  useProjects,
  useUpdateProject,
  useUpdateProjectMembership,
} from '../../api/hooks';
import client from '../../api/client';
import { getAxiosErrorMessage } from '../../api/errorMessage';
import type { Organization, Project, ProjectMembership } from '../../types';

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Заказчик' },
  { value: 'federal_operator', label: 'Федеральный оператор' },
  { value: 'participant', label: 'Участник' },
  { value: 'contractor', label: 'Подрядчик' },
  { value: 'implementer', label: 'Исполнитель' },
];

type ProjectFormValues = { name: string; year: number; code?: string };
type MembershipFormValues = {
  organization: number;
  role: ProjectMembership['role'];
  notes?: string;
  sort_order?: number;
};

/** Минимальная длина запроса: ИНН от 5 цифр, текст от 2 символов. */
function shouldRunOrganizationSearchQuery(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^\d+$/.test(t)) return t.length >= 5;
  return t.length >= 2;
}

export default function ProjectsRegistryPage() {
  const { message } = App.useApp();
  const [search, setSearch] = useState('');

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectEditing, setProjectEditing] = useState<Project | null>(null);
  const [projectForm] = Form.useForm<ProjectFormValues>();

  const [membershipModalOpen, setMembershipModalOpen] = useState(false);
  const [membershipProject, setMembershipProject] = useState<Project | null>(null);
  const [membershipFormOpen, setMembershipFormOpen] = useState(false);
  const [membershipEditing, setMembershipEditing] = useState<ProjectMembership | null>(null);
  const [membershipForm] = Form.useForm<MembershipFormValues>();
  const [organizationSearchOptions, setOrganizationSearchOptions] = useState<{ value: number; label: string }[]>([]);
  const [organizationPinnedOptions, setOrganizationPinnedOptions] = useState<{ value: number; label: string }[]>([]);
  const [organizationSearchLoading, setOrganizationSearchLoading] = useState(false);
  const organizationSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useProjects({
    page_size: 500,
    search: search || undefined,
  });
  const projects = projectsData?.results || [];

  const { data: membershipsData, isLoading: membershipsLoading, refetch: refetchMemberships } = useProjectMemberships(
    membershipProject?.id ? { project: membershipProject.id } : undefined,
  );
  const memberships = membershipsData?.results || [];

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createMembership = useCreateProjectMembership();
  const updateMembership = useUpdateProjectMembership();
  const deleteMembership = useDeleteProjectMembership();

  const mergedOrganizationOptions = useMemo(() => {
    const seen = new Set<number>();
    const out: { value: number; label: string }[] = [];
    for (const o of organizationPinnedOptions) {
      if (seen.has(o.value)) continue;
      seen.add(o.value);
      out.push(o);
    }
    for (const o of organizationSearchOptions) {
      if (seen.has(o.value)) continue;
      seen.add(o.value);
      out.push(o);
    }
    return out;
  }, [organizationPinnedOptions, organizationSearchOptions]);

  const runOrganizationSearch = useCallback(async (q: string) => {
    if (!shouldRunOrganizationSearchQuery(q)) {
      setOrganizationSearchOptions([]);
      return;
    }
    setOrganizationSearchLoading(true);
    try {
      const res = await client.get('/organizations/', {
        params: { search: q.trim(), page_size: 100, ordering: 'name' },
      });
      const rows = res.data?.results || [];
      setOrganizationSearchOptions(
        rows.map((o: Organization) => ({
          value: o.id,
          label: o.inn ? `${o.short_name || o.name} · ИНН ${o.inn}` : (o.short_name || o.name),
        })),
      );
    } catch {
      setOrganizationSearchOptions([]);
    } finally {
      setOrganizationSearchLoading(false);
    }
  }, []);

  const scheduleOrganizationSearch = useCallback(
    (q: string) => {
      if (organizationSearchTimerRef.current) clearTimeout(organizationSearchTimerRef.current);
      organizationSearchTimerRef.current = setTimeout(() => runOrganizationSearch(q), 320);
    },
    [runOrganizationSearch],
  );

  useEffect(() => {
    return () => {
      if (organizationSearchTimerRef.current) clearTimeout(organizationSearchTimerRef.current);
    };
  }, []);

  const handleOrganizationChange: SelectProps['onChange'] = (v, opt) => {
    if (v == null || v === undefined) {
      setOrganizationPinnedOptions([]);
      return;
    }
    const info = Array.isArray(opt) ? opt[0] : opt;
    const label =
      info && typeof info === 'object' && 'label' in info && info.label != null
        ? String(info.label)
        : String(v);
    setOrganizationPinnedOptions([{ value: Number(v), label }]);
  };

  const openCreateProject = () => {
    setProjectEditing(null);
    projectForm.resetFields();
    projectForm.setFieldsValue({ year: new Date().getFullYear() });
    setProjectModalOpen(true);
  };

  const openEditProject = (project: Project) => {
    setProjectEditing(project);
    projectForm.setFieldsValue({
      name: project.name,
      year: project.year,
      code: project.code || '',
    });
    setProjectModalOpen(true);
  };

  const submitProject = async () => {
    try {
      const values = await projectForm.validateFields();
      if (projectEditing) {
        await updateProject.mutateAsync({ id: projectEditing.id, ...values });
        message.success('Проект обновлён');
      } else {
        await createProject.mutateAsync(values);
        message.success('Проект создан');
      }
      setProjectModalOpen(false);
      setProjectEditing(null);
      await refetchProjects();
    } catch (err) {
      if (err instanceof Error && err.message === 'Validation failed') return;
      message.error(`Не удалось сохранить проект: ${getAxiosErrorMessage(err)}`);
    }
  };

  const openMemberships = (project: Project) => {
    setMembershipProject(project);
    setMembershipModalOpen(true);
    setMembershipEditing(null);
    setMembershipFormOpen(false);
    setOrganizationPinnedOptions([]);
    setOrganizationSearchOptions([]);
    membershipForm.resetFields();
  };

  const openCreateMembership = () => {
    setMembershipEditing(null);
    membershipForm.resetFields();
    membershipForm.setFieldsValue({ sort_order: 0 });
    setOrganizationPinnedOptions([]);
    setOrganizationSearchOptions([]);
    setMembershipFormOpen(true);
  };

  const openEditMembership = (membership: ProjectMembership) => {
    setMembershipEditing(membership);
    membershipForm.setFieldsValue({
      organization: membership.organization,
      role: membership.role,
      notes: membership.notes || '',
      sort_order: membership.sort_order || 0,
    });
    setOrganizationPinnedOptions([
      { value: membership.organization, label: membership.organization_name || `ID ${membership.organization}` },
    ]);
    setMembershipFormOpen(true);
  };

  const submitMembership = async () => {
    if (!membershipProject) return;
    try {
      const values = await membershipForm.validateFields();
      const payload = { ...values, project: membershipProject.id };
      if (membershipEditing) {
        await updateMembership.mutateAsync({ id: membershipEditing.id, ...payload });
        message.success('Участник проекта обновлён');
      } else {
        await createMembership.mutateAsync(payload);
        message.success('Участник добавлен в проект');
      }
      setMembershipFormOpen(false);
      setMembershipEditing(null);
      membershipForm.resetFields();
      await refetchMemberships();
      await refetchProjects();
    } catch (err) {
      if (err instanceof Error && err.message === 'Validation failed') return;
      message.error(`Не удалось сохранить участника: ${getAxiosErrorMessage(err)}`);
    }
  };

  const projectColumns: ColumnsType<Project> = [
    { title: 'Название', dataIndex: 'name', key: 'name' },
    { title: 'Год', dataIndex: 'year', key: 'year', width: 110 },
    { title: 'Код', dataIndex: 'code', key: 'code', width: 180, render: (v) => v || '—' },
    {
      title: 'Участников',
      key: 'memberships_count',
      width: 140,
      render: (_: unknown, row: Project) => row.memberships?.length || 0,
    },
    {
      title: '',
      key: 'actions',
      width: 220,
      render: (_: unknown, row: Project) => (
        <Space size="small">
          <Button icon={<TeamOutlined />} onClick={() => openMemberships(row)}>
            Состав
          </Button>
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditProject(row)} />
          <Popconfirm
            title={`Удалить проект «${row.name}»?`}
            description="Связанные роли организаций в проекте будут удалены."
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await deleteProject.mutateAsync(row.id);
                message.success('Проект удалён');
                await refetchProjects();
              } catch (err) {
                message.error(`Не удалось удалить проект: ${getAxiosErrorMessage(err)}`);
              }
            }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const membershipColumns: ColumnsType<ProjectMembership> = [
    { title: 'Организация', dataIndex: 'organization_name', key: 'organization_name' },
    { title: 'Роль', dataIndex: 'role_display', key: 'role_display', width: 220 },
    { title: 'Примечания', dataIndex: 'notes', key: 'notes', render: (v) => v || '—' },
    { title: 'Порядок', dataIndex: 'sort_order', key: 'sort_order', width: 100 },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_: unknown, row: ProjectMembership) => (
        <Space size="small">
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditMembership(row)} />
          <Popconfirm
            title="Удалить роль из проекта?"
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await deleteMembership.mutateAsync(row.id);
                message.success('Роль удалена');
                await refetchMemberships();
                await refetchProjects();
              } catch (err) {
                message.error(`Не удалось удалить роль: ${getAxiosErrorMessage(err)}`);
              }
            }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
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
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          Управление проектами
        </Typography.Title>
        <Space className="filter-bar" wrap>
          <Input.Search
            allowClear
            placeholder="Поиск по названию или коду"
            style={{ width: 320, maxWidth: '100%' }}
            onSearch={setSearch}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateProject}>
            Новый проект
          </Button>
        </Space>
      </div>

      <ResponsiveTable<Project>
        rowKey="id"
        loading={projectsLoading}
        dataSource={projects}
        columns={projectColumns}
        pagination={{ pageSize: 25, showSizeChanger: true }}
      />

      <Modal
        title={projectEditing ? 'Редактировать проект' : 'Новый проект'}
        open={projectModalOpen}
        onOk={submitProject}
        onCancel={() => {
          setProjectModalOpen(false);
          setProjectEditing(null);
        }}
        confirmLoading={createProject.isPending || updateProject.isPending}
        destroyOnClose
      >
        <Form<ProjectFormValues> form={projectForm} layout="vertical">
          <Form.Item label="Название" name="name" rules={[{ required: true, message: 'Укажите название проекта' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Год" name="year" rules={[{ required: true, message: 'Укажите год' }]}>
            <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Код" name="code">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={membershipProject ? `Состав проекта: ${membershipProject.name}` : 'Состав проекта'}
        open={membershipModalOpen}
        onCancel={() => {
          setMembershipModalOpen(false);
          setMembershipProject(null);
          setMembershipFormOpen(false);
          setMembershipEditing(null);
        }}
        footer={[
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateMembership}
            disabled={!membershipProject}
          >
            Добавить роль
          </Button>,
          <Button
            key="close"
            onClick={() => {
              setMembershipModalOpen(false);
              setMembershipProject(null);
              setMembershipFormOpen(false);
              setMembershipEditing(null);
            }}
          >
            Закрыть
          </Button>,
        ]}
        width={980}
      >
        <ResponsiveTable<ProjectMembership>
          rowKey="id"
          loading={membershipsLoading}
          dataSource={memberships}
          columns={membershipColumns}
          pagination={false}
        />

        {membershipFormOpen && (
          <div style={{ marginTop: 16, padding: 16, border: '1px solid #f0f0f0', borderRadius: 8 }}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {membershipEditing ? 'Редактирование роли' : 'Новая роль в проекте'}
            </Typography.Title>
            <Form<MembershipFormValues> form={membershipForm} layout="vertical">
              <Form.Item
                label="Организация"
                name="organization"
                rules={[{ required: true, message: 'Выберите организацию' }]}
              >
                <Select
                  showSearch
                  filterOption={false}
                  placeholder="Выберите организацию"
                  optionFilterProp="label"
                  onSearch={scheduleOrganizationSearch}
                  onChange={handleOrganizationChange}
                  loading={organizationSearchLoading}
                  notFoundContent={
                    organizationSearchLoading ? <Spin size="small" /> : 'Введите ИНН или часть названия'
                  }
                  options={mergedOrganizationOptions}
                />
              </Form.Item>
              <Form.Item label="Роль" name="role" rules={[{ required: true, message: 'Выберите роль' }]}>
                <Select options={ROLE_OPTIONS} />
              </Form.Item>
              <Form.Item label="Порядок" name="sort_order">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="Примечания" name="notes">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Space>
                <Button type="primary" onClick={submitMembership} loading={createMembership.isPending || updateMembership.isPending}>
                  {membershipEditing ? 'Сохранить изменения' : 'Добавить в проект'}
                </Button>
                <Button
                  onClick={() => {
                    setMembershipFormOpen(false);
                    setMembershipEditing(null);
                    membershipForm.resetFields();
                  }}
                >
                  Отмена
                </Button>
              </Space>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

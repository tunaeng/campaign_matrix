import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App, Button, Checkbox, DatePicker, Divider, Drawer, Empty, Input, Progress, Result, Select, Space, Spin, Tag, Typography, Tabs, Upload, Collapse,
} from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ExportOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useAdvanceLeadSubfunnelStage,
  useCampaignCollectStageImport,
  useLeadSubfunnel,
  useOrganizationListCapture,
  usePatchLeadSubfunnel,
  usePatchLeadSubfunnelChecklist,
  useRetreatLeadSubfunnelStage,
  useOrganizationListSelect,
  useOrganizations,
  useContactsByOrganizationId,
  useRegionTaskCapture,
  useRegions,
  useSetLeadSubfunnelStage,
  useTaskTemplateStages,
  useUsers,
} from '../api/hooks';
import { useQueryClient } from '@tanstack/react-query';
import {
  normalizeTaskStatus,
  TASK_STATUS_META,
  TASK_WORKFLOW_STATUSES,
  type TaskWorkflowStatus,
} from '../utils/taskStatusLabels';
import type { LeadSubfunnelChecklistValue, Organization } from '../types';
import { getAxiosErrorMessage } from '../api/errorMessage';
import client from '../api/client';
import type { UploadFile } from 'antd/es/upload/interface';

function shouldRunParentOrgSearchQuery(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^\d+$/.test(t)) return t.length >= 5;
  return t.length >= 2;
}

export interface TaskEditDrawerProps {
  open: boolean;
  taskId: number | null;
  campaignId?: number;
  leadId?: number;
  leadName?: string;
  onClose: () => void;
}

export default function TaskEditDrawer({
  open,
  taskId,
  campaignId,
  leadId,
  leadName,
  onClose,
}: TaskEditDrawerProps) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: task, isLoading, isError, refetch } = useLeadSubfunnel(open ? taskId : null);
  const {
    data: regionCapture,
    isLoading: regionCaptureLoading,
    refetch: refetchRegionCapture,
  } = useRegionTaskCapture(open ? taskId : null);
  const templateId = task?.template_id;
  const { data: stages = [] } = useTaskTemplateStages(templateId);
  const { data: usersData } = useUsers();
  const patchTask = usePatchLeadSubfunnel();
  const patchChecklist = usePatchLeadSubfunnelChecklist();
  const setStage = useSetLeadSubfunnelStage();
  const advanceStage = useAdvanceLeadSubfunnelStage();
  const retreatStage = useRetreatLeadSubfunnelStage();
  const selectFromRegistry = useOrganizationListSelect(campaignId);
  const manualCapture = useOrganizationListCapture(campaignId);
  const collectImport = useCampaignCollectStageImport(campaignId);
  const [addMode, setAddMode] = useState<'base' | 'manual' | 'import'>('base');
  const [useLeadForwarding, setUseLeadForwarding] = useState(false);
  const [leadForwardingComment, setLeadForwardingComment] = useState('');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | undefined>();
  const [selectedContactId, setSelectedContactId] = useState<number | undefined>();
  const [manualOrgName, setManualOrgName] = useState('');
  const [manualOrgShortName, setManualOrgShortName] = useState('');
  const [manualOrgInn, setManualOrgInn] = useState('');
  const [manualOrgType, setManualOrgType] = useState<'roiv' | 'federal' | 'municipal' | 'private' | 'company_branch' | 'other'>('other');
  const [manualOrgRegionId, setManualOrgRegionId] = useState<number | undefined>();
  const [manualParentOrganizationId, setManualParentOrganizationId] = useState<number | undefined>();
  const [parentSearchOptions, setParentSearchOptions] = useState<{ value: number; label: string }[]>([]);
  const [parentSearchLoading, setParentSearchLoading] = useState(false);
  const parentSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manualContactType, setManualContactType] = useState<'person' | 'department' | 'main' | 'other'>('person');
  const [manualContactFirstName, setManualContactFirstName] = useState('');
  const [manualContactLastName, setManualContactLastName] = useState('');
  const [manualContactMiddleName, setManualContactMiddleName] = useState('');
  const [manualContactDepartmentName, setManualContactDepartmentName] = useState('');
  const [manualContactPosition, setManualContactPosition] = useState('');
  const [manualContactPhone, setManualContactPhone] = useState('');
  const [manualContactPhoneExtension, setManualContactPhoneExtension] = useState('');
  const [manualContactEmail, setManualContactEmail] = useState('');
  const [manualContactMessenger, setManualContactMessenger] = useState('');
  const [manualContactIsManager, setManualContactIsManager] = useState(false);
  const [manualContactComment, setManualContactComment] = useState('');
  const [organizationsFileList, setOrganizationsFileList] = useState<UploadFile[]>([]);
  const [contactsFileList, setContactsFileList] = useState<UploadFile[]>([]);

  const userOptions = (usersData?.results || []).map((u) => ({
    value: u.id,
    label: u.full_name || u.username,
  }));
  const { data: organizationsData, isLoading: organizationsLoading } = useOrganizations(
    task?.region_id ? { page_size: 500, region: task.region_id } : { page_size: 500 },
  );
  const { data: regionsData } = useRegions();
  const isManualCompanyBranch = manualOrgType === 'company_branch';
  const regionOptions = useMemo(
    () => (regionsData?.results || []).map((r) => ({ value: r.id, label: r.name })),
    [regionsData?.results],
  );

  const runParentOrgSearch = useCallback(async (q: string) => {
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
        (o: Organization) => o.inn != null && String(o.inn).trim() !== '',
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
  }, []);

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
    if (task?.region_id && manualOrgRegionId == null) {
      setManualOrgRegionId(task.region_id);
    }
  }, [task?.region_id, manualOrgRegionId]);
  useEffect(() => {
    if (!open) return;
    setAddMode('base');
    setUseLeadForwarding(false);
    setLeadForwardingComment('');
    setSelectedOrganizationId(undefined);
    setSelectedContactId(undefined);
  }, [open, taskId]);
  const { data: organizationContactsData, isLoading: organizationContactsLoading } = useContactsByOrganizationId(
    selectedOrganizationId,
  );
  const organizationOptions = (organizationsData?.results || []).map((o) => ({
    value: o.id,
    label: o.region_name ? `${o.name} (${o.region_name})` : o.name,
  }));
  const contactOptions = (organizationContactsData?.results || []).map((c) => ({
    value: c.id,
    label: c.full_name || `Контакт #${c.id}`,
  }));

  const stageOptions = useMemo(
    () =>
      [...stages]
        .filter((s) => s.is_active || s.id === task?.current_template_stage)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ value: s.id, label: s.name })),
    [stages, task?.current_template_stage],
  );

  const checklistByStage = useMemo(() => {
    const map = new Map<string, LeadSubfunnelChecklistValue[]>();
    for (const row of task?.checklist_values || []) {
      const key = row.template_item_stage_name || 'Без этапа';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => a.template_item_order - b.template_item_order);
    }
    return map;
  }, [task?.checklist_values]);

  const checklistProgress = useMemo(() => {
    const rows = task?.checklist_values || [];
    if (!rows.length) return null;
    const completed = rows.filter((r) => r.is_completed).length;
    return { total: rows.length, completed };
  }, [task?.checklist_values]);

  const statusOptions = useMemo(
    () => TASK_WORKFLOW_STATUSES.map((status) => ({
      value: status,
      label: TASK_STATUS_META[status].label,
    })),
    [],
  );

  const resolvedCampaignId = campaignId ?? undefined;
  const resolvedLeadId = leadId ?? task?.lead;
  const resolvedLeadName = leadName;
  const drawerTitle = resolvedLeadName || task?.display_name || 'Задача';
  const refreshCampaignData = async () => {
    if (!resolvedCampaignId) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['campaign', String(resolvedCampaignId)] }),
      qc.invalidateQueries({ queryKey: ['campaigns'] }),
    ]);
  };

  function saveChecklistRow(row: LeadSubfunnelChecklistValue, patch: Partial<LeadSubfunnelChecklistValue>) {
    if (!taskId) return;
    patchChecklist.mutate(
      { id: taskId, rows: [{ id: row.id, ...patch }] },
      {
        onSuccess: (data: any) => {
          const rows = data?.rows;
          if (Array.isArray(rows)) {
            qc.setQueryData(['lead-subfunnel', taskId], (prev: any) => {
              if (!prev) return prev;
              return { ...prev, checklist_values: rows };
            });
          }
        },
        onError: () => message.error('Не удалось сохранить пункт чек-листа'),
      },
    );
  }

  return (
    <Drawer
      title={drawerTitle}
      open={open}
      onClose={onClose}
      width={520}
      destroyOnClose
      extra={
        resolvedCampaignId ? (
          <Space direction="vertical" size={0} align="end">
            <Button
              type="link"
              icon={<ExportOutlined />}
              onClick={() => {
                window.open(`/campaigns/${resolvedCampaignId}`, '_blank', 'noopener,noreferrer');
              }}
            >
              Открыть кампанию
            </Button>
            {resolvedLeadId ? (
              <Button
                type="link"
                icon={<ExportOutlined />}
                onClick={() => {
                  window.open(`/campaigns/${resolvedCampaignId}/leads/${resolvedLeadId}`, '_blank', 'noopener,noreferrer');
                }}
              >
                Открыть лид
              </Button>
            ) : null}
          </Space>
        ) : null
      }
    >
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      )}
      {!isLoading && isError && (
        <Result
          status="error"
          title="Не удалось загрузить задачу"
          extra={
            <Button type="primary" onClick={() => refetch()}>
              Повторить
            </Button>
          }
        />
      )}
      {!isLoading && !isError && !task && (
        <Empty description="Задача не найдена" />
      )}
      {!isLoading && task && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text type="secondary">{task.template_name}</Typography.Text>
          <Space wrap>
            <Tag color={TASK_STATUS_META[normalizeTaskStatus(task.status)]?.color || 'default'}>
              {TASK_STATUS_META[normalizeTaskStatus(task.status)]?.label || task.status}
            </Tag>
            {task.forwarded_from && <Tag color="gold">Передано от: {task.forwarded_from}</Tag>}
            {task.role_name && <Tag>{task.role_name}</Tag>}
            {!task.is_available && <Tag color="default">Вне диапазона стадий</Tag>}
          </Space>

          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              Статус
            </Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={normalizeTaskStatus(task.status)}
              options={statusOptions}
              loading={patchTask.isPending}
              onChange={(nextStatus: TaskWorkflowStatus) => {
                patchTask.mutate(
                  { id: task.id, status: nextStatus },
                  {
                    onSuccess: () => message.success('Статус обновлён'),
                    onError: () => message.error('Не удалось сменить статус'),
                  },
                );
              }}
            />
          </div>

          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              Этап задачи
            </Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={task.current_template_stage ?? undefined}
              options={stageOptions}
              loading={setStage.isPending}
              onChange={(stageId) => {
                setStage.mutate(
                  { id: task.id, stage_id: stageId },
                  {
                    onSuccess: () => message.success('Этап обновлён'),
                    onError: () => message.error('Не удалось сменить этап'),
                  },
                );
              }}
            />
          </div>

          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              Исполнитель
            </Typography.Text>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              placeholder="Не назначен"
              value={task.assignee ?? undefined}
              options={userOptions}
              loading={patchTask.isPending}
              onChange={(assignee) => {
                patchTask.mutate(
                  { id: task.id, assignee: assignee ?? null },
                  {
                    onSuccess: () => message.success('Исполнитель сохранён'),
                    onError: () => message.error('Не удалось назначить исполнителя'),
                  },
                );
              }}
            />
          </div>

          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              Срок
            </Typography.Text>
            <DatePicker
              style={{ width: '100%' }}
              value={task.due_at ? dayjs(task.due_at) : null}
              onChange={(d) => {
                patchTask.mutate(
                  { id: task.id, due_at: d ? d.toISOString() : null },
                  {
                    onSuccess: () => message.success('Срок сохранён'),
                    onError: () => message.error('Не удалось сохранить срок'),
                  },
                );
              }}
            />
          </div>

          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              disabled={!task.can_retreat_stage}
              loading={retreatStage.isPending}
              onClick={() => {
                retreatStage.mutate(
                  { id: task.id },
                  {
                    onSuccess: () => { message.success('Этап изменён'); refetch(); },
                    onError: () => message.error('Нельзя вернуть этап'),
                  },
                );
              }}
            >
              Назад
            </Button>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              disabled={!task.can_advance_stage}
              loading={advanceStage.isPending}
              onClick={() => {
                advanceStage.mutate(
                  { id: task.id },
                  {
                    onSuccess: () => { message.success('Этап изменён'); refetch(); },
                    onError: () => message.error('Нельзя перейти дальше'),
                  },
                );
              }}
            >
              Вперёд
            </Button>
          </Space>

          {resolvedCampaignId && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <Typography.Text strong>Добавление из базы</Typography.Text>
              <Typography.Text type="secondary">
                Выберите способ: из базы, ручное добавление новых или импорт XLSX.
              </Typography.Text>
              {!!task.lead && (
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  <Checkbox
                    checked={useLeadForwarding}
                    onChange={(e) => setUseLeadForwarding(e.target.checked)}
                  >
                    Добавить как дополнительный лид/задачу (передано от текущей организации)
                  </Checkbox>
                  {useLeadForwarding && (
                    <Input.TextArea
                      placeholder="Комментарий по передаче (опционально)"
                      value={leadForwardingComment}
                      onChange={(e) => setLeadForwardingComment(e.target.value)}
                      autoSize={{ minRows: 2, maxRows: 4 }}
                    />
                  )}
                </Space>
              )}
              <Tabs
                activeKey={addMode}
                onChange={(next) => setAddMode(next as 'base' | 'manual' | 'import')}
                items={[
                  {
                    key: 'base',
                    label: 'Из базы',
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Select
                          showSearch
                          allowClear
                          optionFilterProp="label"
                          style={{ width: '100%' }}
                          placeholder="Организация"
                          loading={organizationsLoading}
                          value={selectedOrganizationId}
                          options={organizationOptions}
                          onChange={(next) => {
                            setSelectedOrganizationId(next);
                            setSelectedContactId(undefined);
                          }}
                        />
                        <Select
                          showSearch
                          allowClear
                          optionFilterProp="label"
                          style={{ width: '100%' }}
                          placeholder={selectedOrganizationId ? 'Контакт (необязательно)' : 'Сначала выберите организацию'}
                          disabled={!selectedOrganizationId}
                          loading={organizationContactsLoading}
                          value={selectedContactId}
                          options={contactOptions}
                          onChange={(next) => setSelectedContactId(next)}
                        />
                        <Button
                          type="primary"
                          loading={selectFromRegistry.isPending}
                          disabled={!selectedOrganizationId || !resolvedCampaignId}
                          onClick={async () => {
                            if (!resolvedCampaignId || !selectedOrganizationId) {
                              message.error('Недостаточно данных для добавления в задачу.');
                              return;
                            }
                            try {
                              const result = await selectFromRegistry.mutateAsync({
                                campaign_region_id: task.campaign_region_id ?? undefined,
                                force_task_addition: true,
                                source_lead_id: useLeadForwarding && task.lead ? task.lead : undefined,
                                source_transfer_comment: useLeadForwarding
                                  ? leadForwardingComment.trim() || undefined
                                  : undefined,
                                items: [
                                  {
                                    organization_id: selectedOrganizationId,
                                    contact_id: selectedContactId ?? null,
                                  },
                                ],
                              });
                              const linked = result.organizations_linked ?? 0;
                              const created = result.leads_created ?? 0;
                              if (Array.isArray(result.errors) && result.errors.length) {
                                message.warning(
                                  `Добавлено/привязано: ${linked}, новых лидов: ${created}. Есть замечания: ${result.errors[0]}`,
                                );
                              } else {
                                message.success(`Добавлено/привязано: ${linked}, новых лидов: ${created}.`);
                              }
                              await refreshCampaignData();
                              await refetch();
                              await refetchRegionCapture();
                            } catch (err) {
                              message.error(getAxiosErrorMessage(err));
                            }
                          }}
                        >
                          Добавить из базы
                        </Button>
                      </Space>
                    ),
                  },
                  {
                    key: 'manual',
                    label: 'Добавить новые',
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Input
                          placeholder="ИНН"
                          value={manualOrgInn}
                          onChange={(e) => setManualOrgInn(e.target.value)}
                          maxLength={12}
                          disabled={isManualCompanyBranch}
                        />
                        <Input
                          placeholder="Название организации *"
                          value={manualOrgName}
                          onChange={(e) => setManualOrgName(e.target.value)}
                        />
                        <Input
                          placeholder="Короткое название"
                          value={manualOrgShortName}
                          onChange={(e) => setManualOrgShortName(e.target.value)}
                        />
                        <Select
                          style={{ width: '100%' }}
                          value={manualOrgType}
                          options={[
                            { value: 'roiv', label: 'РОИВ' },
                            { value: 'federal', label: 'Федеральная' },
                            { value: 'municipal', label: 'Муниципальная' },
                            { value: 'private', label: 'Коммерческая' },
                            { value: 'company_branch', label: 'Подразделение (без ИНН)' },
                            { value: 'other', label: 'Другое' },
                          ]}
                          onChange={(v) => {
                            setManualOrgType(v);
                            if (v === 'company_branch') {
                              setManualOrgInn('');
                            } else {
                              setManualParentOrganizationId(undefined);
                              setParentSearchOptions([]);
                            }
                          }}
                        />
                        {isManualCompanyBranch && (
                          <Select
                            allowClear
                            showSearch
                            filterOption={false}
                            style={{ width: '100%' }}
                            value={manualParentOrganizationId}
                            loading={parentSearchLoading}
                            onSearch={scheduleParentOrgSearch}
                            onChange={(v) => setManualParentOrganizationId(v)}
                            placeholder="Головная организация * (ИНН или название)"
                            optionFilterProp="label"
                            options={parentSearchOptions}
                            notFoundContent={
                              parentSearchLoading ? <Spin size="small" /> : 'Введите ИНН или название для поиска'
                            }
                          />
                        )}
                        <Select
                          style={{ width: '100%' }}
                          showSearch
                          allowClear
                          placeholder="Регион"
                          optionFilterProp="label"
                          value={manualOrgRegionId}
                          options={regionOptions}
                          onChange={(v) => setManualOrgRegionId(v)}
                        />
                        <Collapse
                          items={[
                            {
                              key: 'contact-fields',
                              label: 'Поля контакта (опционально)',
                              children: (
                                <Space direction="vertical" style={{ width: '100%' }}>
                                  <Select
                                    style={{ width: '100%' }}
                                    value={manualContactType}
                                    options={[
                                      { value: 'person', label: 'Физлицо' },
                                      { value: 'department', label: 'Подразделение' },
                                      { value: 'main', label: 'Основной контакт' },
                                      { value: 'other', label: 'Другое' },
                                    ]}
                                    onChange={(v) => setManualContactType(v)}
                                  />
                                  <Input
                                    placeholder="Имя"
                                    value={manualContactFirstName}
                                    onChange={(e) => setManualContactFirstName(e.target.value)}
                                  />
                                  <Input
                                    placeholder="Фамилия"
                                    value={manualContactLastName}
                                    onChange={(e) => setManualContactLastName(e.target.value)}
                                  />
                                  <Input
                                    placeholder="Отчество"
                                    value={manualContactMiddleName}
                                    onChange={(e) => setManualContactMiddleName(e.target.value)}
                                  />
                                  <Input
                                    placeholder="Подразделение"
                                    value={manualContactDepartmentName}
                                    onChange={(e) => setManualContactDepartmentName(e.target.value)}
                                  />
                                  <Input
                                    placeholder="Должность"
                                    value={manualContactPosition}
                                    onChange={(e) => setManualContactPosition(e.target.value)}
                                  />
                                  <Space size={12} style={{ width: '100%' }} align="start">
                                    <Input
                                      placeholder="Телефон"
                                      value={manualContactPhone}
                                      onChange={(e) => setManualContactPhone(e.target.value)}
                                      style={{ flex: 1 }}
                                    />
                                    <Input
                                      placeholder="Добавочный"
                                      value={manualContactPhoneExtension}
                                      onChange={(e) => setManualContactPhoneExtension(e.target.value)}
                                      style={{ width: 120 }}
                                    />
                                  </Space>
                                  <Input
                                    placeholder="Email"
                                    value={manualContactEmail}
                                    onChange={(e) => setManualContactEmail(e.target.value)}
                                  />
                                  <Input
                                    placeholder="Мессенджер"
                                    value={manualContactMessenger}
                                    onChange={(e) => setManualContactMessenger(e.target.value)}
                                  />
                                  <Input.TextArea
                                    placeholder="Комментарий"
                                    value={manualContactComment}
                                    onChange={(e) => setManualContactComment(e.target.value)}
                                    autoSize={{ minRows: 2, maxRows: 5 }}
                                  />
                                  <Checkbox
                                    checked={manualContactIsManager}
                                    onChange={(e) => setManualContactIsManager(e.target.checked)}
                                  >
                                    Руководитель
                                  </Checkbox>
                                </Space>
                              ),
                            },
                          ]}
                        />
                        <Button
                          type="primary"
                          loading={manualCapture.isPending}
                          onClick={async () => {
                            const orgName = manualOrgName.trim();
                            if (!orgName) {
                              message.error('Укажите название организации.');
                              return;
                            }
                            if (isManualCompanyBranch && !manualParentOrganizationId) {
                              message.error('Для подразделения выберите головную организацию.');
                              return;
                            }
                            try {
                              const parsedRegionId = manualOrgRegionId ?? task?.region_id ?? undefined;
                              const payloadItem: Record<string, any> = {
                                organization: {
                                  name: orgName,
                                  short_name: manualOrgShortName.trim() || orgName,
                                  inn: isManualCompanyBranch ? undefined : (manualOrgInn.trim() || undefined),
                                  region_id: parsedRegionId,
                                  org_type: manualOrgType,
                                  parent_organization_id: isManualCompanyBranch
                                    ? manualParentOrganizationId
                                    : undefined,
                                },
                              };
                              const hasContact =
                                !!manualContactFirstName.trim()
                                || !!manualContactLastName.trim()
                                || !!manualContactMiddleName.trim()
                                || !!manualContactDepartmentName.trim()
                                || !!manualContactPosition.trim()
                                || !!manualContactPhone.trim()
                                || !!manualContactPhoneExtension.trim()
                                || !!manualContactEmail.trim()
                                || !!manualContactMessenger.trim()
                                || !!manualContactComment.trim()
                                || manualContactIsManager;
                              if (hasContact) {
                                payloadItem.contact = {
                                  type: manualContactType,
                                  first_name: manualContactFirstName.trim(),
                                  last_name: manualContactLastName.trim(),
                                  middle_name: manualContactMiddleName.trim(),
                                  department_name: manualContactDepartmentName.trim(),
                                  position: manualContactPosition.trim(),
                                  phone: manualContactPhone.trim(),
                                  phone_extension: manualContactPhoneExtension.trim(),
                                  email: manualContactEmail.trim(),
                                  messenger: manualContactMessenger.trim(),
                                  is_manager: manualContactIsManager,
                                  comment: manualContactComment.trim(),
                                };
                              }
                              const result = await manualCapture.mutateAsync({
                                mode: 'minimal',
                                campaign_region_id: task.campaign_region_id ?? undefined,
                                force_task_addition: true,
                                source_lead_id: useLeadForwarding && task.lead ? task.lead : undefined,
                                source_transfer_comment: useLeadForwarding
                                  ? leadForwardingComment.trim() || undefined
                                  : undefined,
                                items: [payloadItem],
                              });
                              message.success(
                                `Создано: ${result.summary?.created ?? 0}, пропущено: ${result.summary?.skipped ?? 0}.`,
                              );
                              setManualOrgName('');
                              setManualOrgShortName('');
                              setManualOrgInn('');
                              setManualOrgType('other');
                              setManualOrgRegionId(task?.region_id ?? undefined);
                              setManualParentOrganizationId(undefined);
                              setParentSearchOptions([]);
                              setManualContactType('person');
                              setManualContactFirstName('');
                              setManualContactLastName('');
                              setManualContactMiddleName('');
                              setManualContactDepartmentName('');
                              setManualContactPosition('');
                              setManualContactPhone('');
                              setManualContactPhoneExtension('');
                              setManualContactEmail('');
                              setManualContactMessenger('');
                              setManualContactIsManager(false);
                              setManualContactComment('');
                              await refreshCampaignData();
                              await refetch();
                              await refetchRegionCapture();
                            } catch (err) {
                              message.error(getAxiosErrorMessage(err));
                            }
                          }}
                        >
                          Добавить новые
                        </Button>
                      </Space>
                    ),
                  },
                  {
                    key: 'import',
                    label: 'Импорт XLSX',
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Upload
                          accept=".xlsx"
                          maxCount={1}
                          beforeUpload={() => false}
                          fileList={organizationsFileList}
                          onChange={({ fileList }) => setOrganizationsFileList(fileList.slice(-1))}
                        >
                          <Button icon={<UploadOutlined />}>Файл организаций (.xlsx)</Button>
                        </Upload>
                        <Upload
                          accept=".xlsx"
                          maxCount={1}
                          beforeUpload={() => false}
                          fileList={contactsFileList}
                          onChange={({ fileList }) => setContactsFileList(fileList.slice(-1))}
                        >
                          <Button icon={<UploadOutlined />}>Файл контактов (.xlsx)</Button>
                        </Upload>
                        <Button
                          type="primary"
                          loading={collectImport.isPending}
                          onClick={async () => {
                            const orgFile = organizationsFileList[0]?.originFileObj;
                            const contactsFile = contactsFileList[0]?.originFileObj;
                            if (!orgFile && !contactsFile) {
                              message.error('Выберите файл организаций и/или контактов.');
                              return;
                            }
                            try {
                              const fd = new FormData();
                              if (orgFile) fd.append('organizations_file', orgFile);
                              if (contactsFile) fd.append('contacts_file', contactsFile);
                              if (task.campaign_region_id) {
                                fd.append('campaign_region_id', String(task.campaign_region_id));
                              }
                              fd.append('force_task_addition', 'true');
                              if (useLeadForwarding && task.lead) {
                                fd.append('source_lead_id', String(task.lead));
                                if (leadForwardingComment.trim()) {
                                  fd.append('source_transfer_comment', leadForwardingComment.trim());
                                }
                              }
                              const result = await collectImport.mutateAsync(fd);
                              const linked = result.organizations_linked ?? 0;
                              const created = result.leads_created ?? 0;
                              if (Array.isArray(result.errors) && result.errors.length) {
                                message.warning(
                                  `Импорт завершён: привязано ${linked}, новых лидов ${created}. Есть замечания.`,
                                );
                              } else {
                                message.success(`Импорт завершён: привязано ${linked}, новых лидов ${created}.`);
                              }
                              setOrganizationsFileList([]);
                              setContactsFileList([]);
                              await refreshCampaignData();
                              await refetch();
                              await refetchRegionCapture();
                            } catch (err) {
                              message.error(getAxiosErrorMessage(err));
                            }
                          }}
                        >
                          Импортировать в задачу
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </>
          )}

          {task.is_region_task && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <Typography.Text strong>Добавленные организации/контакты</Typography.Text>
              {regionCaptureLoading ? (
                <Spin size="small" />
              ) : !regionCapture?.organizations?.length ? (
                <Typography.Text type="secondary">Пока ничего не добавлено.</Typography.Text>
              ) : (
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  {regionCapture.organizations.map((row) => (
                    <div key={`${row.organization_id}-${row.lead_id}`} style={{ padding: '8px 10px', borderRadius: 6, background: '#fafafa' }}>
                      <Typography.Text strong>{row.organization_name || `Организация #${row.organization_id}`}</Typography.Text>
                      <div style={{ fontSize: 12, color: '#595959' }}>
                        Контакт: {row.primary_contact || '—'}
                      </div>
                    </div>
                  ))}
                </Space>
              )}
            </>
          )}

          {checklistProgress && checklistProgress.total > 0 && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <Typography.Text strong>Чек-лист</Typography.Text>
              <Progress
                percent={Math.round((checklistProgress.completed / checklistProgress.total) * 100)}
                size="small"
                format={() => `${checklistProgress.completed}/${checklistProgress.total}`}
              />
              {[...checklistByStage.entries()].map(([stageName, rows]) => (
                <div key={stageName} style={{ marginTop: 8 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {stageName}
                  </Typography.Text>
                  <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 4 }}>
                    {rows.map((row) => (
                      <div
                        key={row.id}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: row.is_completed ? '#f6ffed' : '#fafafa',
                        }}
                      >
                        <Checkbox
                          checked={row.is_completed}
                          disabled={patchChecklist.isPending}
                          onChange={(e) => saveChecklistRow(row, { is_completed: e.target.checked })}
                        >
                          {row.template_item_title}
                        </Checkbox>
                        <Input.TextArea
                          autoSize={{ minRows: 1, maxRows: 4 }}
                          placeholder="Комментарий / данные"
                          defaultValue={row.text_value}
                          style={{ marginTop: 4 }}
                          onBlur={(e) => {
                            const next = e.target.value;
                            if (next === (row.text_value || '')) return;
                            saveChecklistRow(row, { text_value: next });
                          }}
                        />
                      </div>
                    ))}
                  </Space>
                </div>
              ))}
            </>
          )}
        </Space>
      )}
    </Drawer>
  );
}

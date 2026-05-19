import { useMemo } from 'react';
import {
  App, Button, Checkbox, DatePicker, Divider, Drawer, Input, Progress, Select, Space, Spin, Tag, Typography,
} from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ExportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  useAdvanceLeadSubfunnelStage,
  useLeadSubfunnel,
  usePatchLeadSubfunnel,
  usePatchLeadSubfunnelChecklist,
  useRetreatLeadSubfunnelStage,
  useSetLeadSubfunnelStage,
  useTaskTemplateStages,
  useUsers,
} from '../api/hooks';
import type { LeadSubfunnelChecklistValue } from '../types';

const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  todo: { label: 'К выполнению', color: 'default' },
  in_progress: { label: 'В работе', color: 'processing' },
  blocked: { label: 'Заблокирована', color: 'warning' },
  done: { label: 'Завершена', color: 'success' },
};

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
  const navigate = useNavigate();
  const { data: task, isLoading, refetch } = useLeadSubfunnel(open ? taskId : null);
  const templateId = task?.template_id;
  const { data: stages = [] } = useTaskTemplateStages(templateId);
  const { data: usersData } = useUsers();
  const patchTask = usePatchLeadSubfunnel();
  const patchChecklist = usePatchLeadSubfunnelChecklist();
  const setStage = useSetLeadSubfunnelStage();
  const advanceStage = useAdvanceLeadSubfunnelStage();
  const retreatStage = useRetreatLeadSubfunnelStage();

  const userOptions = (usersData?.results || []).map((u) => ({
    value: u.id,
    label: u.full_name || u.username,
  }));

  const stageOptions = useMemo(
    () => [...stages].sort((a, b) => a.order - b.order).map((s) => ({ value: s.id, label: s.name })),
    [stages],
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

  const resolvedCampaignId = campaignId ?? undefined;
  const resolvedLeadId = leadId ?? task?.lead;
  const resolvedLeadName = leadName;

  function saveChecklistRow(row: LeadSubfunnelChecklistValue, patch: Partial<LeadSubfunnelChecklistValue>) {
    if (!taskId) return;
    patchChecklist.mutate(
      { id: taskId, rows: [{ id: row.id, ...patch }] },
      {
        onError: () => message.error('Не удалось сохранить пункт чек-листа'),
      },
    );
  }

  return (
    <Drawer
      title={task ? `Задача: ${task.template_name}` : 'Задача'}
      open={open}
      onClose={onClose}
      width={520}
      destroyOnClose
      extra={
        resolvedCampaignId && resolvedLeadId ? (
          <Button
            type="link"
            icon={<ExportOutlined />}
            onClick={() => {
              navigate(`/campaigns/${resolvedCampaignId}/leads/${resolvedLeadId}`);
              onClose();
            }}
          >
            Открыть лид
          </Button>
        ) : null
      }
    >
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      )}
      {!isLoading && task && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {resolvedLeadName && (
            <Typography.Text type="secondary">Лид: {resolvedLeadName}</Typography.Text>
          )}
          <Space wrap>
            <Tag color={TASK_STATUS_META[task.status]?.color || 'default'}>
              {TASK_STATUS_META[task.status]?.label || task.status}
            </Tag>
            {task.role_name && <Tag>{task.role_name}</Tag>}
            {!task.is_available && <Tag color="default">Вне диапазона стадий</Tag>}
          </Space>

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

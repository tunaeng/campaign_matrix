import { useEffect, useMemo, useRef } from 'react';
import {
  Card, Space, Typography, Input, DatePicker, Button, InputNumber,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useFunnel } from '../../../api/hooks';
import type { CampaignFormData } from '../CampaignCreatePage';

function addBusinessDays(startDate: string, days: number): string {
  let date = dayjs(startDate);
  let remaining = days;
  while (remaining > 0) {
    date = date.add(1, 'day');
    if (date.day() !== 0 && date.day() !== 6) remaining--;
  }
  return date.format('DD.MM.YYYY');
}

interface Props {
  data: CampaignFormData;
  onChange: (partial: Partial<CampaignFormData>) => void;
  onQueueRemoved?: (removedQueueNumber: number) => void;
}

export default function QueueScheduleSection({ data, onChange, onQueueRemoved }: Props) {
  const selectedFunnelId = data.selectedFunnels[0];
  const { data: funnelDetail } = useFunnel(selectedFunnelId || 0);
  const initializedFunnelRef = useRef<number | null>(null);

  useEffect(() => {
    if (!funnelDetail?.stages?.length) return;
    if (initializedFunnelRef.current === funnelDetail.id) return;
    initializedFunnelRef.current = funnelDetail.id;

    const stages = [...funnelDetail.stages].filter((s) => !s.is_rejection).sort((a, b) => a.order - b.order);
    const today = dayjs().format('YYYY-MM-DD');

    const newQueues = data.queues.map((q, idx) => {
      const existingIds = new Set(q.stage_deadlines.map((d) => d.funnel_stage_id));
      const missingStages = stages.filter((s) => !existingIds.has(s.id));
      const newDeadlines = missingStages.length > 0
        ? [
            ...q.stage_deadlines,
            ...missingStages.map((s) => ({ funnel_stage_id: s.id, deadline_days: s.deadline_days })),
          ]
        : q.stage_deadlines;
      const newStartDate = (idx === 0 && !q.start_date) ? today : q.start_date;
      return { ...q, stage_deadlines: newDeadlines, start_date: newStartDate };
    });
    onChange({ queues: newQueues });
  }, [funnelDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedStages = useMemo(
    () => funnelDetail?.stages
      ? [...funnelDetail.stages].filter((s) => !s.is_rejection).sort((a, b) => a.order - b.order)
      : [],
    [funnelDetail],
  );

  const addQueue = () => {
    const nextNum = data.queues.length + 1;
    onChange({
      queues: [
        ...data.queues,
        {
          queue_number: nextNum,
          name: `Очередь ${nextNum}`,
          start_date: null,
          end_date: null,
          stage_deadlines: [],
        },
      ],
    });
  };

  const removeQueue = (idx: number) => {
    if (data.queues.length <= 1) return;
    const removedNum = data.queues[idx].queue_number;
    const newQueues = data.queues
      .filter((_, i) => i !== idx)
      .map((q, i) => ({ ...q, queue_number: i + 1 }));
    onChange({ queues: newQueues });
    onQueueRemoved?.(removedNum);
  };

  const updateQueue = (idx: number, field: string, value: unknown) => {
    const newQueues = [...data.queues];
    newQueues[idx] = { ...newQueues[idx], [field]: value };
    onChange({ queues: newQueues });
  };

  const updateStageDeadline = (queueIdx: number, stageId: number, days: number | null) => {
    const newQueues = [...data.queues];
    const queue = { ...newQueues[queueIdx] };
    const deadlines = [...(queue.stage_deadlines || [])];
    const existingIdx = deadlines.findIndex((d) => d.funnel_stage_id === stageId);
    if (existingIdx >= 0) {
      deadlines[existingIdx] = { ...deadlines[existingIdx], deadline_days: days || 0 };
    } else {
      deadlines.push({ funnel_stage_id: stageId, deadline_days: days || 0 });
    }
    queue.stage_deadlines = deadlines;
    newQueues[queueIdx] = queue;
    onChange({ queues: newQueues });
  };

  return (
    <Card size="small" title="Очереди" style={{ marginBottom: 16 }}>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Для каждой очереди задайте дату старта и количество рабочих дней на каждый этап воронки.
      </Typography.Text>
      {data.queues.map((q, qIdx) => (
        <Card
          key={q.queue_number}
          size="small"
          style={{ marginBottom: 8 }}
          title={(
            <Space wrap>
              <Input
                size="small"
                value={q.name}
                onChange={(e) => updateQueue(qIdx, 'name', e.target.value)}
                style={{ width: 160 }}
              />
              <DatePicker
                size="small"
                value={q.start_date ? dayjs(q.start_date) : null}
                onChange={(d) => updateQueue(qIdx, 'start_date', d ? d.format('YYYY-MM-DD') : null)}
                format="DD.MM.YYYY"
                placeholder="Дата старта"
              />
              {data.queues.length > 1 && (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeQueue(qIdx)} />
              )}
            </Space>
          )}
        >
          {sortedStages.length > 0 ? (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #f0f0f0' }}>
                <Typography.Text type="secondary" style={{ width: 220, fontSize: 12 }}>Этап</Typography.Text>
                <Typography.Text type="secondary" style={{ width: 130, fontSize: 12 }}>Рабочих дней</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Дата дедлайна</Typography.Text>
              </div>
              {sortedStages.map((stage) => {
                const override = q.stage_deadlines.find((d) => d.funnel_stage_id === stage.id);
                const days = override?.deadline_days ?? stage.deadline_days;
                const deadlineDate = q.start_date ? addBusinessDays(q.start_date, days) : null;
                return (
                  <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Typography.Text style={{ width: 220 }}>{stage.name}</Typography.Text>
                    <InputNumber
                      size="small"
                      min={0}
                      value={days}
                      onChange={(v) => updateStageDeadline(qIdx, stage.id, v)}
                      addonAfter="р.д."
                      style={{ width: 130 }}
                    />
                    {deadlineDate
                      ? <Typography.Text type="secondary">{deadlineDate}</Typography.Text>
                      : <Typography.Text type="secondary">— укажите дату старта</Typography.Text>}
                  </div>
                );
              })}
            </div>
          ) : (
            <Typography.Text type="secondary">Выберите воронку на шаге «Основное»</Typography.Text>
          )}
        </Card>
      ))}
      <Button type="dashed" icon={<PlusOutlined />} onClick={addQueue}>
        Добавить очередь
      </Button>
    </Card>
  );
}

export function remapQueueNumber(
  queueNumber: number | null | undefined,
  removedQueueNumber: number,
): number {
  const qn = queueNumber ?? 1;
  if (qn === removedQueueNumber) return 1;
  if (qn > removedQueueNumber) return qn - 1;
  return qn;
}

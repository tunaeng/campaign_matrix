/** Подписи статусов задач и срезов графиков дашборда «Загрузка команд». */

import dayjs, { type Dayjs } from 'dayjs';
import { TASK_WORKFLOW_STATUSES, taskStatusLabel } from './taskStatusLabels';

const WORKLOAD_STATUS_LABELS: Record<string, string> = {
  overdue: 'Просрочено',
};

export type WorkloadActivityGroup = 'day' | 'week' | 'month';

export const WORKLOAD_ACTIVITY_GROUP_OPTIONS: Array<{ value: WorkloadActivityGroup; label: string }> = [
  { value: 'day', label: 'Дни' },
  { value: 'week', label: 'Недели' },
  { value: 'month', label: 'Месяцы' },
];

export function workloadStatusLabel(status: string): string {
  return WORKLOAD_STATUS_LABELS[status] || taskStatusLabel(status);
}

export function workloadStatusPieData(
  items: Array<{ status: string; count: number }> | undefined,
): Array<{ status: string; status_label: string; count: number }> {
  return (items || []).map((item) => ({
    status: item.status,
    status_label: workloadStatusLabel(item.status),
    count: item.count,
  }));
}

function startOfWeekMonday(d: Dayjs): Dayjs {
  const day = d.day();
  const diff = day === 0 ? 6 : day - 1;
  return d.subtract(diff, 'day').startOf('day');
}

function bucketActivityDate(isoDate: string, group: WorkloadActivityGroup): Dayjs {
  const d = dayjs(isoDate);
  if (group === 'week') return startOfWeekMonday(d);
  if (group === 'month') return d.startOf('month');
  return d.startOf('day');
}

export function formatWorkloadPeriodLabel(isoDate: string): string {
  return dayjs(isoDate).format('DD.MM.YY');
}

export const WORKLOAD_STATUS_CHART_COLORS: Record<string, string> = {
  backlog: '#8c8c8c',
  in_progress: '#1677ff',
  paused: '#faad14',
  rejected: '#ff4d4f',
  done: '#52c41a',
};

export const WORKLOAD_STATUS_CHART_LABELS = TASK_WORKFLOW_STATUSES.map((status) => taskStatusLabel(status));

export interface WorkloadActivityPeriodPoint {
  date?: string;
  backlog?: number;
  in_progress?: number;
  paused?: number;
  rejected?: number;
  done?: number;
}

export function workloadActivityChartData(
  points: WorkloadActivityPeriodPoint[] | undefined,
  group: WorkloadActivityGroup,
): Array<{ period: string; status: string; status_label: string; value: number }> {
  const buckets = new Map<string, WorkloadActivityPeriodPoint & { sort: number }>();

  for (const point of points || []) {
    if (!point.date) continue;
    const bucketDate = bucketActivityDate(point.date, group);
    const key = bucketDate.format('YYYY-MM-DD');
    const sort = bucketDate.valueOf();
    const bucket = buckets.get(key) || {
      sort,
      backlog: 0,
      in_progress: 0,
      paused: 0,
      rejected: 0,
      done: 0,
    };
    for (const status of TASK_WORKFLOW_STATUSES) {
      bucket[status] = (bucket[status] || 0) + (point[status] || 0);
    }
    bucket.sort = sort;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[1].sort - b[1].sort)
    .flatMap(([key, bucket]) =>
      TASK_WORKFLOW_STATUSES.map((status) => ({
        period: formatWorkloadPeriodLabel(key),
        status,
        status_label: taskStatusLabel(status),
        value: bucket[status] || 0,
      })),
    );
}

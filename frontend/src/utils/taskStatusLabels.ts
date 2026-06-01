export type TaskWorkflowStatus = 'backlog' | 'in_progress' | 'paused' | 'rejected' | 'done';

export const TASK_WORKFLOW_STATUSES: TaskWorkflowStatus[] = [
  'backlog',
  'in_progress',
  'paused',
  'rejected',
  'done',
];

export const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  backlog: { label: 'Бэклог', color: 'default' },
  in_progress: { label: 'В работе', color: 'processing' },
  paused: { label: 'Пауза', color: 'warning' },
  rejected: { label: 'Отказ', color: 'error' },
  done: { label: 'Готово', color: 'success' },
  todo: { label: 'Бэклог', color: 'default' },
  blocked: { label: 'Пауза', color: 'warning' },
};

export function normalizeTaskStatus(status: string): TaskWorkflowStatus {
  if (status === 'todo') return 'backlog';
  if (status === 'blocked') return 'paused';
  if (TASK_WORKFLOW_STATUSES.includes(status as TaskWorkflowStatus)) {
    return status as TaskWorkflowStatus;
  }
  return 'backlog';
}

export function taskStatusLabel(status: string): string {
  return TASK_STATUS_META[normalizeTaskStatus(status)]?.label || status;
}

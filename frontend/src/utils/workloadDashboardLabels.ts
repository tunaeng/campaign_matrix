/** Подписи статусов задач и срезов графиков дашборда «Загрузка команд». */

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Завершено',
  overdue: 'Просрочено',
};

export function workloadStatusLabel(status: string): string {
  return TASK_STATUS_LABELS[status] || status;
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

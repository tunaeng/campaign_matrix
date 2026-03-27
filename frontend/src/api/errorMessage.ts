import type { AxiosError } from 'axios';

/** Сообщение для UI из ответа axios/DRF или сетевой ошибки. */
export function getAxiosErrorMessage(error: unknown): string {
  if (!error) return 'Неизвестная ошибка';
  const ax = error as AxiosError<Record<string, unknown>>;
  const raw = ax.response?.data as unknown;
  if (typeof raw === 'string' && raw.trim()) return raw;
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (d && 'detail' in d) {
    const det = d.detail;
    if (typeof det === 'string') return det;
    if (Array.isArray(det)) return det.map(String).join(' ');
  }
  const st = ax.response?.status;
  if (st === 401) return 'Требуется вход.';
  if (st === 403) return 'Нет доступа.';
  if (st === 502 || st === 503 || st === 504) {
    return 'Сервер недоступен. Убедитесь, что API запущен (например, Django на порту 8000 при работе через Vite).';
  }
  if (ax.message === 'Network Error') {
    return 'Сеть: не удалось связаться с сервером. Проверьте, что backend запущен и прокси /api настроен.';
  }
  if (error instanceof Error) return error.message;
  return 'Не удалось выполнить запрос.';
}

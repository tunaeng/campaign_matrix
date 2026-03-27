import type { Lead } from '../types';

/** Полных календарных дней с даты последнего взаимодействия до сегодня. Нет касаний — `null`. */
export function daysSinceLastTouch(lead: Lead): number | null {
  const raw = lead.last_interaction?.date;
  if (!raw) return null;
  const last = new Date(raw);
  const today = new Date();
  const L = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  const T = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((T.getTime() - L.getTime()) / 86400000);
}

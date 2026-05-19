/** Отображение телефона и добавочного в одной строке */
export function formatPhoneWithExtension(phone?: string | null, ext?: string | null): string {
  const p = (phone ?? '').trim();
  const e = (ext ?? '').trim();
  if (!p && !e) return '';
  if (!e) return p;
  if (!p) return `доб. ${e}`;
  return `${p} доб. ${e}`;
}

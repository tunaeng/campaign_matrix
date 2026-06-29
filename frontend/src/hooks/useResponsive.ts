import { Grid } from 'antd';

/**
 * Единая точка истины для адаптивности.
 * Брейкпоинты совпадают с antd Grid: xs <576, sm ≥576, md ≥768, lg ≥992, xl ≥1200.
 * «Мобильный» режим = ширина < md (768px) — телефоны и узкие планшеты в портрете.
 */
export const MOBILE_BREAKPOINT = 768;

export function useBreakpoints() {
  return Grid.useBreakpoint();
}

/** true, если вьюпорт уже md (< 768px) — основной флаг для мобильной вёрстки. */
export function useIsMobile(): boolean {
  const screens = Grid.useBreakpoint();
  // Пока antd не вычислил брейкпоинты (первый рендер), считаем десктопом,
  // чтобы не мигать мобильной вёрсткой на широких экранах.
  if (screens.md === undefined) return false;
  return !screens.md;
}

/** true, если вьюпорт уже lg (< 992px) — для «плотных» десктопных экранов (дашборды, матрицы). */
export function useIsCompact(): boolean {
  const screens = Grid.useBreakpoint();
  if (screens.lg === undefined) return false;
  return !screens.lg;
}

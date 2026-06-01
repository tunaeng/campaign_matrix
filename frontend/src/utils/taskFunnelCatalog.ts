export const CANONICAL_TASK_FUNNEL_SLUGS = [
  'lead-search-and-capture',
  'email-and-primary-contact',
] as const;

export type CanonicalTaskFunnelSlug = (typeof CANONICAL_TASK_FUNNEL_SLUGS)[number];

export function isCanonicalTaskFunnel(slug: string): slug is CanonicalTaskFunnelSlug {
  return (CANONICAL_TASK_FUNNEL_SLUGS as readonly string[]).includes(slug);
}

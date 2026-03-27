import { AimOutlined } from '@ant-design/icons';
import type { CampaignDemandSummary, Lead } from '../types';

export function demandPair(collected: number, quota: number): string {
  if (quota > 0) return `${collected}/${quota}`;
  if (collected > 0) return `${collected}`;
  return '—';
}

export type DemandBreakdown = CampaignDemandSummary;

export function leadToDemandBreakdown(l: Lead): DemandBreakdown {
  return {
    plan: l.forecast_demand ?? 0,
    declared_collected: l.demand_collected_declared ?? 0,
    declared_quota: l.demand_quota_declared ?? 0,
    list_collected: l.demand_collected_list ?? 0,
    list_quota: l.demand_quota_list ?? 0,
  };
}

function planLabel(plan: number): string | number {
  return plan > 0 ? plan : '—';
}

/** План · заявл. собр/кв · спис. собр/кв */
export default function DemandQuotaPreview({ breakdown }: { breakdown: DemandBreakdown }) {
  return (
    <div style={{ fontSize: 11, color: '#555', lineHeight: 1.35 }}>
      <AimOutlined style={{ marginRight: 4, color: '#1677ff' }} />
      <span>План: {planLabel(breakdown.plan)}</span>
      <span style={{ margin: '0 4px', color: '#d9d9d9' }}>·</span>
      <span>Заявл.: {demandPair(breakdown.declared_collected, breakdown.declared_quota)}</span>
      <span style={{ margin: '0 4px', color: '#d9d9d9' }}>·</span>
      <span>Спис.: {demandPair(breakdown.list_collected, breakdown.list_quota)}</span>
    </div>
  );
}

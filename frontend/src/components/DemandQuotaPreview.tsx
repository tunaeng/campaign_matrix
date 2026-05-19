import { AimOutlined } from '@ant-design/icons';
import type { CampaignDemandSummary, Lead } from '../types';

export type DemandBreakdown = CampaignDemandSummary;

export function leadToDemandBreakdown(l: Lead): DemandBreakdown {
  return {
    plan: l.forecast_demand ?? 0,
    declared_collected: 0,
    declared_quota: l.demand_quota_declared ?? 0,
    list_collected: l.demand_count ?? l.demand_collected_list ?? 0,
    list_quota: l.demand_quota_list ?? l.demand_count ?? l.demand_collected_list ?? 0,
  };
}

function planLabel(plan: number): string | number {
  return plan > 0 ? plan : '—';
}

function quotaLabel(value: number): string | number {
  return value > 0 ? value : '—';
}

function listFactValue(breakdown: DemandBreakdown): number {
  return breakdown.list_quota > 0 ? breakdown.list_quota : breakdown.list_collected;
}

/** План · заявленная квота · списочная (факт) */
export default function DemandQuotaPreview({ breakdown }: { breakdown: DemandBreakdown }) {
  return (
    <div style={{ fontSize: 11, color: '#555', lineHeight: 1.35 }}>
      <AimOutlined style={{ marginRight: 4, color: '#1677ff' }} />
      <span>План: {planLabel(breakdown.plan)}</span>
      <span style={{ margin: '0 4px', color: '#d9d9d9' }}>·</span>
      <span>Заявл.: {quotaLabel(breakdown.declared_quota)}</span>
      <span style={{ margin: '0 4px', color: '#d9d9d9' }}>·</span>
      <span>Спис. (факт): {quotaLabel(listFactValue(breakdown))}</span>
    </div>
  );
}

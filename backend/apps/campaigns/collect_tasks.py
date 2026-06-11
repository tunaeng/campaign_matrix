from __future__ import annotations

from apps.funnels.models import TaskTemplateStage

from .models import Campaign, LeadSubfunnel


def get_entry_funnel_stage_for_lead(funnel):
    """
    Entry stage for a lead:
    - first non-rejection and non-collect stage
    - fallback: first non-rejection stage
    """
    stage = funnel.stages.filter(is_rejection=False, is_collect_stage=False).order_by("order", "id").first()
    if stage:
        return stage
    return funnel.stages.filter(is_rejection=False).order_by("order", "id").first()


def _has_collect_stage(campaign: Campaign) -> bool:
    return campaign.funnels.filter(stages__is_collect_stage=True).exists()


def _default_template_stage(subfunnel):
    return (
        TaskTemplateStage.objects.filter(template_id=subfunnel.template_id)
        .order_by("order", "id")
        .first()
    )


def _is_collect_stage_subfunnel(subfunnel, collect_stage):
    if not collect_stage:
        return False
    binding = subfunnel.binding
    if not binding:
        # Keep backward-compatible fallback for canonical collect template.
        return (getattr(subfunnel.template, "slug", "") or "") == "lead-search-and-capture"
    if binding.binding_type in {"stage", "checklist_item"}:
        return binding.target_stage_id == collect_stage.id
    if binding.binding_type == "stage_range_checklist":
        if not binding.from_stage_id or not binding.to_stage_id:
            return False
        return binding.from_stage.order <= collect_stage.order <= binding.to_stage.order
    return False


def _sync_region_tasks(campaign: Campaign) -> None:
    """
    Materialize region-level tasks for active campaign subfunnels.
    These tasks are used in collect-stage workspace.
    """
    regions = list(campaign.campaign_regions.all())
    collect_stage_by_funnel_id = {}
    for funnel in campaign.funnels.prefetch_related("stages").all():
        collect_stage = funnel.stages.filter(is_collect_stage=True).order_by("order", "id").first()
        if collect_stage:
            collect_stage_by_funnel_id[funnel.id] = collect_stage

    active_subfunnels = list(
        campaign.subfunnels.filter(is_active=True).select_related(
            "template",
            "binding",
            "binding__target_stage",
            "binding__from_stage",
            "binding__to_stage",
        )
    )

    valid_pairs = set()
    for sub in active_subfunnels:
        collect_stage = collect_stage_by_funnel_id.get(sub.funnel_id)
        if not _is_collect_stage_subfunnel(sub, collect_stage):
            continue
        default_stage = _default_template_stage(sub)
        defaults = {
            "assignee_id": sub.default_assignee_id,
            "current_template_stage": default_stage,
            "status": LeadSubfunnel.Status.BACKLOG,
            "is_available": True,
        }
        for region in regions:
            valid_pairs.add((sub.id, region.id))
            LeadSubfunnel.objects.get_or_create(
                campaign_subfunnel=sub,
                campaign_region=region,
                defaults=defaults,
            )

    for row in LeadSubfunnel.objects.filter(campaign_region__campaign=campaign).select_related(
        "campaign_subfunnel", "campaign_region"
    ):
        if (row.campaign_subfunnel_id, row.campaign_region_id) not in valid_pairs:
            row.delete()


def activate_collect_campaign_workflow(campaign: Campaign) -> None:
    has_collect = _has_collect_stage(campaign)
    desired_stage = (
        Campaign.OperationalStage.ORGANIZATION_LIST if has_collect else ""
    )
    if campaign.operational_stage != desired_stage:
        campaign.operational_stage = desired_stage
        campaign.save(update_fields=["operational_stage", "updated_at"])

    if has_collect:
        _sync_region_tasks(campaign)
    else:
        LeadSubfunnel.objects.filter(campaign_region__campaign=campaign).delete()


def deactivate_collect_campaign_workflow(campaign: Campaign) -> None:
    if campaign.operational_stage:
        campaign.operational_stage = ""
        campaign.save(update_fields=["operational_stage", "updated_at"])
    LeadSubfunnel.objects.filter(campaign_region__campaign=campaign).delete()

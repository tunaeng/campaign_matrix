from django.contrib import admin
from .models import (
    Campaign, CampaignQueue, CampaignProgram,
    CampaignRegion, CampaignOrganization,
    CampaignFunnel, QueueStageDeadline,
    Lead, LeadChecklistValue, LeadInteraction,
)


class QueueInline(admin.TabularInline):
    model = CampaignQueue
    extra = 0


class ProgramInline(admin.TabularInline):
    model = CampaignProgram
    extra = 0


class RegionInline(admin.TabularInline):
    model = CampaignRegion
    extra = 0


class OrganizationInline(admin.TabularInline):
    model = CampaignOrganization
    extra = 0


class CampaignFunnelInline(admin.TabularInline):
    model = CampaignFunnel
    extra = 0


class LeadInline(admin.TabularInline):
    model = Lead
    extra = 0
    fields = ["organization", "funnel", "queue", "current_stage", "manager", "primary_contact"]


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = [
        "name", "status", "federal_operator",
        "created_by", "created_at",
    ]
    list_filter = ["status", "federal_operator"]
    search_fields = ["name"]
    inlines = [
        CampaignFunnelInline, QueueInline, ProgramInline,
        RegionInline, OrganizationInline, LeadInline,
    ]


class QueueStageDeadlineInline(admin.TabularInline):
    model = QueueStageDeadline
    extra = 0


@admin.register(CampaignQueue)
class CampaignQueueAdmin(admin.ModelAdmin):
    list_display = ["campaign", "queue_number", "name", "start_date"]
    inlines = [QueueStageDeadlineInline]


class LeadChecklistValueInline(admin.TabularInline):
    model = LeadChecklistValue
    extra = 0


class LeadInteractionInline(admin.TabularInline):
    model = LeadInteraction
    extra = 0


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ["organization", "campaign", "funnel", "current_stage", "manager", "primary_contact"]
    list_filter = ["campaign", "funnel"]
    inlines = [LeadChecklistValueInline, LeadInteractionInline]

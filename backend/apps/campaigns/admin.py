from django.contrib import admin
from .models import (
    Campaign, CampaignQueue, CampaignProgram,
    CampaignRegion, CampaignOrganization,
    CampaignFunnel, QueueStageDeadline,
    Lead, LeadChecklistValue, LeadInteraction,
    CampaignSubfunnel, LeadSubfunnel, LeadSubfunnelChecklistValue,
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
    fields = ["organization", "region", "funnel", "queue", "current_stage", "manager", "primary_contact"]


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = [
        "name", "status", "project", "federal_operator", "acting_organization",
        "created_by", "created_at",
    ]
    list_filter = ["status", "project", "federal_operator", "acting_organization"]
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


class CampaignSubfunnelInline(admin.TabularInline):
    model = CampaignSubfunnel
    extra = 0


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ["organization", "region", "campaign", "funnel", "current_stage", "manager", "primary_contact"]
    list_filter = ["campaign", "funnel"]
    inlines = [LeadChecklistValueInline, LeadInteractionInline]


@admin.register(CampaignSubfunnel)
class CampaignSubfunnelAdmin(admin.ModelAdmin):
    list_display = ["campaign", "template", "funnel", "role", "default_assignee", "is_active"]
    list_filter = ["is_active", "funnel", "role"]
    search_fields = ["campaign__name", "template__name"]


@admin.register(LeadSubfunnel)
class LeadSubfunnelAdmin(admin.ModelAdmin):
    list_display = ["lead", "campaign_subfunnel", "status", "assignee", "is_available", "due_at"]
    list_filter = ["status", "is_available"]
    search_fields = ["lead__organization__name", "campaign_subfunnel__template__name"]


@admin.register(LeadSubfunnelChecklistValue)
class LeadSubfunnelChecklistValueAdmin(admin.ModelAdmin):
    list_display = ["lead_subfunnel", "template_item", "is_completed", "assignee", "completed_at"]
    list_filter = ["is_completed"]

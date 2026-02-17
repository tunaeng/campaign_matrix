from django.contrib import admin
from .models import (
    Campaign, CampaignQueue, CampaignProgram,
    CampaignRegion, CampaignOrganization,
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


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = [
        "name", "status", "federal_operator",
        "forecast_demand", "deadline", "created_by", "created_at",
    ]
    list_filter = ["status", "federal_operator"]
    search_fields = ["name"]
    inlines = [QueueInline, ProgramInline, RegionInline, OrganizationInline]

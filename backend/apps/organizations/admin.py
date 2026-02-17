from django.contrib import admin
from .models import Organization, OrganizationInteraction


class InteractionInline(admin.TabularInline):
    model = OrganizationInteraction
    extra = 0
    readonly_fields = ["created_at"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "org_type", "region", "parent_organization"]
    list_filter = ["org_type", "region__federal_district"]
    search_fields = ["name", "short_name", "inn"]
    inlines = [InteractionInline]


@admin.register(OrganizationInteraction)
class OrganizationInteractionAdmin(admin.ModelAdmin):
    list_display = ["organization", "date", "interaction_type", "user"]
    list_filter = ["interaction_type", "date"]
    search_fields = ["organization__name"]

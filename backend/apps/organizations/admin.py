from django.contrib import admin
from .models import Organization, OrganizationInteraction, Contact


class InteractionInline(admin.TabularInline):
    model = OrganizationInteraction
    extra = 0
    readonly_fields = ["created_at"]


class ContactInline(admin.TabularInline):
    model = Contact
    extra = 0
    fields = ["type", "first_name", "last_name", "middle_name", "position", "phone", "email", "current"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "org_type", "region", "parent_organization"]
    list_filter = ["org_type", "region__federal_district"]
    search_fields = ["name", "short_name", "inn"]
    inlines = [ContactInline, InteractionInline]


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ["__str__", "organization", "type", "position", "current"]
    list_filter = ["type", "current"]
    search_fields = ["first_name", "last_name", "organization__name"]


@admin.register(OrganizationInteraction)
class OrganizationInteractionAdmin(admin.ModelAdmin):
    list_display = ["organization", "date", "interaction_type", "user"]
    list_filter = ["interaction_type", "date"]
    search_fields = ["organization__name"]

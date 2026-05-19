from django.contrib import admin
from .models import (
    Organization,
    OrganizationInteraction,
    Contact,
    OrganizationTag,
    Project,
    ProjectOrganizationMembership,
    UserActingOrganization,
    BitrixOAuthConnection,
)


class InteractionInline(admin.TabularInline):
    model = OrganizationInteraction
    fk_name = "organization"
    extra = 0
    readonly_fields = ["created_at"]


class ContactInline(admin.TabularInline):
    model = Contact
    extra = 0
    fields = [
        "type",
        "first_name",
        "last_name",
        "middle_name",
        "position",
        "phone",
        "phone_extension",
        "email",
        "current",
    ]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "inn", "org_type", "region", "is_our_side", "parent_organization"]
    list_filter = ["org_type", "is_our_side", "region__federal_district", "tags"]
    search_fields = ["name", "short_name", "inn"]
    inlines = [ContactInline, InteractionInline]


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ["__str__", "organization", "type", "position", "current"]
    list_filter = ["type", "current"]
    search_fields = ["first_name", "last_name", "organization__name"]


@admin.register(OrganizationInteraction)
class OrganizationInteractionAdmin(admin.ModelAdmin):
    list_display = ["organization", "project", "acting_organization", "date", "interaction_type", "user"]
    list_filter = ["project", "interaction_type", "date"]
    search_fields = ["organization__name"]


@admin.register(OrganizationTag)
class OrganizationTagAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "color"]
    search_fields = ["name", "slug"]


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["name", "year", "code"]
    list_filter = ["year"]
    search_fields = ["name", "code"]


@admin.register(ProjectOrganizationMembership)
class ProjectOrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ["project", "organization", "role", "sort_order"]
    list_filter = ["role", "project__year"]
    search_fields = ["project__name", "organization__name"]


@admin.register(UserActingOrganization)
class UserActingOrganizationAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "is_primary", "created_at"]
    list_filter = ["is_primary"]
    search_fields = ["user__username", "organization__name", "organization__inn"]


@admin.register(BitrixOAuthConnection)
class BitrixOAuthConnectionAdmin(admin.ModelAdmin):
    list_display = ["title", "base_url", "is_active", "expires_at", "updated_at"]
    list_filter = ["is_active"]
    search_fields = ["title", "base_url"]

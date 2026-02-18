from django.contrib import admin
from .models import (
    FederalDistrict, Region, Profession, ProfessionDemandStatus,
    ProfessionDemandStatusHistory, ProfessionApprovalStatus, Program, FederalOperator, Contract,
    ContractProgram, Quota,
)


class ProfessionDemandStatusHistoryInline(admin.TabularInline):
    model = ProfessionDemandStatusHistory
    extra = 0
    can_delete = False
    fields = [
        "changed_at", "federal_operator", "profession", "region", "year",
        "previous_is_demanded", "new_is_demanded",
    ]
    readonly_fields = fields
    ordering = ["-changed_at"]
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(FederalDistrict)
class FederalDistrictAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "short_name"]
    search_fields = ["name"]


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "federal_district"]
    list_filter = ["federal_district"]
    search_fields = ["name"]


@admin.register(Profession)
class ProfessionAdmin(admin.ModelAdmin):
    list_display = ["number", "name"]
    search_fields = ["name"]


@admin.register(ProfessionDemandStatus)
class ProfessionDemandStatusAdmin(admin.ModelAdmin):
    list_display = ["federal_operator", "profession", "region", "is_demanded", "year"]
    list_filter = ["year", "is_demanded", "federal_operator", "region__federal_district"]
    search_fields = ["profession__name", "region__name"]
    inlines = [ProfessionDemandStatusHistoryInline]


@admin.register(ProfessionDemandStatusHistory)
class ProfessionDemandStatusHistoryAdmin(admin.ModelAdmin):
    list_display = [
        "changed_at", "federal_operator", "profession", "region", "year",
        "previous_is_demanded", "new_is_demanded",
    ]
    list_filter = ["year", "new_is_demanded", "federal_operator", "region__federal_district"]
    search_fields = ["profession__name", "region__name", "federal_operator__name", "federal_operator__short_name"]
    readonly_fields = [
        "changed_at", "demand_status", "federal_operator", "profession", "region",
        "year", "previous_is_demanded", "new_is_demanded",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProfessionApprovalStatus)
class ProfessionApprovalStatusAdmin(admin.ModelAdmin):
    list_display = ["profession", "region", "approval_status", "approved_date", "year"]
    list_filter = ["year", "approval_status", "region__federal_district"]
    search_fields = ["profession__name", "region__name"]
    date_hierarchy = "approved_date"


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ["name", "profession", "hours", "is_active"]
    list_filter = ["is_active", "profession"]
    search_fields = ["name"]


@admin.register(FederalOperator)
class FederalOperatorAdmin(admin.ModelAdmin):
    list_display = ["name", "short_name"]
    search_fields = ["name", "short_name"]


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ["federal_operator", "number", "year", "status"]
    list_filter = ["status", "year", "federal_operator"]


@admin.register(ContractProgram)
class ContractProgramAdmin(admin.ModelAdmin):
    list_display = ["contract", "program", "status"]
    list_filter = ["status"]


@admin.register(Quota)
class QuotaAdmin(admin.ModelAdmin):
    list_display = ["federal_operator", "program", "region", "year", "total", "used"]
    list_filter = ["year", "federal_operator"]

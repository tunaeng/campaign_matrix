from django.contrib import admin
from .models import (
    FederalDistrict, Region, Profession, ProfessionDemandStatus,
    ProfessionApprovalStatus, Program, FederalOperator, Contract,
    ContractProgram, Quota,
)


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
    list_display = ["profession", "region", "is_demanded", "year"]
    list_filter = ["year", "is_demanded", "region__federal_district"]
    search_fields = ["profession__name", "region__name"]


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
    list_display = ["name", "code"]
    search_fields = ["name"]


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

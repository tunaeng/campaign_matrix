from django.contrib import admin, messages
from .models import (
    FederalDistrict, Region, Profession, ProfessionDemandStatus,
    ProfessionDemandStatusHistory, ProfessionApprovalStatus, Program, FederalOperator, Contract,
    ContractProgram, Quota, DemandImport, DemandImportSnapshot,
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


class DemandImportSnapshotInline(admin.TabularInline):
    model = DemandImportSnapshot
    extra = 0
    can_delete = False
    fields = ["profession", "region", "is_demanded"]
    readonly_fields = fields
    show_change_link = False
    max_num = 0

    def has_add_permission(self, request, obj=None):
        return False


@admin.action(description="Откатить до выбранной версии импорта")
def rollback_to_import(modeladmin, request, queryset):
    if queryset.count() != 1:
        modeladmin.message_user(
            request,
            "Выберите ровно один импорт для отката.",
            messages.ERROR,
        )
        return

    demand_import = queryset.first()
    snapshot_qs = DemandImportSnapshot.objects.filter(
        demand_import=demand_import,
    ).values_list("profession_id", "region_id", "is_demanded")

    snapshot_map = {}
    for prof_id, reg_id, demanded in snapshot_qs:
        snapshot_map[(prof_id, reg_id)] = demanded

    if not snapshot_map:
        modeladmin.message_user(
            request,
            "Снимок пуст — откат невозможен.",
            messages.ERROR,
        )
        return

    fo = demand_import.federal_operator
    year = demand_import.year

    existing = {
        (s.profession_id, s.region_id): s
        for s in ProfessionDemandStatus.objects.filter(
            federal_operator=fo, year=year,
        ).only("id", "profession_id", "region_id", "is_demanded")
    }

    to_update = []
    to_create = []

    for (prof_id, reg_id), demanded in snapshot_map.items():
        obj = existing.get((prof_id, reg_id))
        if obj is None:
            to_create.append(ProfessionDemandStatus(
                federal_operator=fo,
                profession_id=prof_id,
                region_id=reg_id,
                year=year,
                is_demanded=demanded,
            ))
        elif obj.is_demanded != demanded:
            obj.is_demanded = demanded
            to_update.append(obj)

    keys_to_delete = set(existing.keys()) - set(snapshot_map.keys())

    BATCH = 1000
    for i in range(0, len(to_create), BATCH):
        ProfessionDemandStatus.objects.bulk_create(to_create[i:i + BATCH])
    for i in range(0, len(to_update), BATCH):
        ProfessionDemandStatus.objects.bulk_update(
            to_update[i:i + BATCH], ["is_demanded"],
        )

    if keys_to_delete:
        from django.db.models import Q
        delete_q = Q()
        for prof_id, reg_id in keys_to_delete:
            delete_q |= Q(profession_id=prof_id, region_id=reg_id)
        ProfessionDemandStatus.objects.filter(
            delete_q, federal_operator=fo, year=year,
        ).delete()

    modeladmin.message_user(
        request,
        f"Откат выполнен: создано {len(to_create)}, "
        f"обновлено {len(to_update)}, удалено {len(keys_to_delete)}.",
        messages.SUCCESS,
    )


@admin.register(DemandImport)
class DemandImportAdmin(admin.ModelAdmin):
    list_display = [
        "imported_at", "federal_operator", "year",
        "imported_by", "snapshot_count",
    ]
    list_filter = ["year", "federal_operator"]
    readonly_fields = [
        "federal_operator", "year", "imported_at",
        "imported_by", "snapshot_count",
    ]
    inlines = [DemandImportSnapshotInline]
    actions = [rollback_to_import]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return True


@admin.register(Quota)
class QuotaAdmin(admin.ModelAdmin):
    list_display = ["federal_operator", "program", "region", "year", "total", "used"]
    list_filter = ["year", "federal_operator"]

from django.contrib import admin
from .models import Funnel, FunnelStage, StageChecklistItem, ChecklistItemOption


class ChecklistItemOptionInline(admin.TabularInline):
    model = ChecklistItemOption
    extra = 0


class StageChecklistItemInline(admin.TabularInline):
    model = StageChecklistItem
    extra = 0
    show_change_link = True


class FunnelStageInline(admin.TabularInline):
    model = FunnelStage
    extra = 0
    show_change_link = True


@admin.register(Funnel)
class FunnelAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name"]
    inlines = [FunnelStageInline]


@admin.register(FunnelStage)
class FunnelStageAdmin(admin.ModelAdmin):
    list_display = ["funnel", "name", "order", "deadline_days"]
    list_filter = ["funnel"]
    inlines = [StageChecklistItemInline]


@admin.register(StageChecklistItem)
class StageChecklistItemAdmin(admin.ModelAdmin):
    list_display = ["text", "stage", "order", "confirmation_type"]
    list_filter = ["confirmation_type", "stage__funnel"]
    inlines = [ChecklistItemOptionInline]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FunnelViewSet,
    FunnelStageViewSet,
    StageChecklistItemViewSet,
    ChecklistItemOptionViewSet,
    SubfunnelTemplateViewSet,
    SubfunnelTemplateItemViewSet,
    TaskTemplateStageViewSet,
    SubfunnelTemplateBindingViewSet,
)

router = DefaultRouter()
router.register("funnels", FunnelViewSet, basename="funnel")
router.register("funnel-stages", FunnelStageViewSet, basename="funnel-stage")
router.register(
    "checklist-items", StageChecklistItemViewSet, basename="checklist-item"
)
router.register(
    "checklist-options", ChecklistItemOptionViewSet, basename="checklist-option"
)
router.register("subfunnel-templates", SubfunnelTemplateViewSet, basename="subfunnel-template")
router.register(
    "subfunnel-template-items", SubfunnelTemplateItemViewSet, basename="subfunnel-template-item"
)
router.register("task-template-stages", TaskTemplateStageViewSet, basename="task-template-stage")
router.register(
    "subfunnel-template-bindings",
    SubfunnelTemplateBindingViewSet,
    basename="subfunnel-template-binding",
)

urlpatterns = [
    path("", include(router.urls)),
]

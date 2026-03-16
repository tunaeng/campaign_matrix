from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FunnelViewSet,
    FunnelStageViewSet,
    StageChecklistItemViewSet,
    ChecklistItemOptionViewSet,
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

urlpatterns = [
    path("", include(router.urls)),
]

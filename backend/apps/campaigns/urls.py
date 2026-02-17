from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CampaignViewSet, CampaignQueueViewSet,
    CampaignOrganizationViewSet,
)

router = DefaultRouter()
router.register("campaigns", CampaignViewSet, basename="campaign")
router.register("campaign-queues", CampaignQueueViewSet, basename="campaign-queue")
router.register(
    "campaign-organizations",
    CampaignOrganizationViewSet,
    basename="campaign-organization",
)

urlpatterns = [
    path("", include(router.urls)),
]

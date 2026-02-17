from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrganizationViewSet, OrganizationInteractionViewSet

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("interactions", OrganizationInteractionViewSet, basename="interaction")

urlpatterns = [
    path("", include(router.urls)),
]

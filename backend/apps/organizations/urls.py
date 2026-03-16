from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, OrganizationInteractionViewSet, ContactViewSet,
    external_organizations, external_fed_districts,
    external_regions, external_org_types, external_prof_activities,
    sync_external_organizations,
    external_contacts, sync_external_contacts,
)

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("interactions", OrganizationInteractionViewSet, basename="interaction")
router.register("contacts", ContactViewSet, basename="contact")

urlpatterns = [
    path("", include(router.urls)),
    path("external-organizations/", external_organizations, name="external-organizations"),
    path("external-organizations/fed-districts/", external_fed_districts, name="external-fed-districts"),
    path("external-organizations/regions/", external_regions, name="external-regions"),
    path("external-organizations/org-types/", external_org_types, name="external-org-types"),
    path("external-organizations/prof-activities/", external_prof_activities, name="external-prof-activities"),
    path("external-organizations/sync/", sync_external_organizations, name="sync-external-organizations"),
    path("external-contacts/", external_contacts, name="external-contacts"),
    path("external-contacts/sync/", sync_external_contacts, name="sync-external-contacts"),
]

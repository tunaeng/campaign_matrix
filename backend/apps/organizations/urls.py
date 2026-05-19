from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, OrganizationInteractionViewSet, ContactViewSet,
    OrganizationTagViewSet, ProjectViewSet, ProjectOrganizationMembershipViewSet,
    UserActingOrganizationViewSet,
    external_organizations, external_organizations_our_side, external_fed_districts,
    external_regions, external_org_types, external_prof_activities,
    sync_external_organizations,
    external_contacts, sync_external_contacts,
    external_contact_add, external_contact_update, external_contact_history,
    external_communications, external_communication_add, external_communication_update,
    sync_user_as_our_side_contact,
    me_acting_organizations,
    communication_history,
)

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("interactions", OrganizationInteractionViewSet, basename="interaction")
router.register("contacts", ContactViewSet, basename="contact")
router.register("organization-tags", OrganizationTagViewSet, basename="organization-tag")
router.register("projects", ProjectViewSet, basename="project")
router.register("project-memberships", ProjectOrganizationMembershipViewSet, basename="project-membership")
router.register("acting-organizations", UserActingOrganizationViewSet, basename="acting-organization")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "useractingorganization/",
        UserActingOrganizationViewSet.as_view({"get": "list", "post": "create"}),
        name="useractingorganization-list",
    ),
    path(
        "useractingorganization/<int:pk>/",
        UserActingOrganizationViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="useractingorganization-detail",
    ),
    path("external-organizations/", external_organizations, name="external-organizations"),
    path("external-organizations/our-side/", external_organizations_our_side, name="external-organizations-our-side"),
    path("external-organizations/fed-districts/", external_fed_districts, name="external-fed-districts"),
    path("external-organizations/regions/", external_regions, name="external-regions"),
    path("external-organizations/org-types/", external_org_types, name="external-org-types"),
    path("external-organizations/prof-activities/", external_prof_activities, name="external-prof-activities"),
    path("external-organizations/sync/", sync_external_organizations, name="sync-external-organizations"),
    path("external-contacts/", external_contacts, name="external-contacts"),
    path("external-contacts/sync/", sync_external_contacts, name="sync-external-contacts"),
    path("external-contacts/add/", external_contact_add, name="external-contact-add"),
    path("external-contacts/update/", external_contact_update, name="external-contact-update"),
    path("external-contacts/history/", external_contact_history, name="external-contact-history"),
    path("external-contacts/sync-user/", sync_user_as_our_side_contact, name="external-contact-sync-user"),
    path("external-communications/", external_communications, name="external-communications"),
    path("external-communications/add/", external_communication_add, name="external-communication-add"),
    path("external-communications/update/", external_communication_update, name="external-communication-update"),
    path("me/acting-organizations/", me_acting_organizations, name="me-acting-organizations"),
    path("communication-history/", communication_history, name="communication-history"),
]

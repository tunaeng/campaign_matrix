from rest_framework import viewsets
from django.db.models import Exists, OuterRef
from .models import Organization, OrganizationInteraction
from .serializers import (
    OrganizationSerializer, OrganizationShortSerializer,
    OrganizationInteractionSerializer,
)


class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer
    filterset_fields = ["org_type", "region", "parent_organization"]
    search_fields = ["name", "short_name", "inn"]

    def get_queryset(self):
        qs = Organization.objects.select_related(
            "region", "parent_organization"
        ).prefetch_related("interactions")

        has_history = self.request.query_params.get("has_history")
        if has_history is not None:
            has_history = has_history.lower() == "true"
            qs = qs.annotate(
                _has_history=Exists(
                    OrganizationInteraction.objects.filter(
                        organization=OuterRef("pk")
                    )
                )
            ).filter(_has_history=has_history)

        region_ids = self.request.query_params.get("region_ids")
        if region_ids:
            ids = [int(x) for x in region_ids.split(",")]
            qs = qs.filter(region_id__in=ids)

        return qs


class OrganizationInteractionViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationInteractionSerializer
    filterset_fields = ["organization", "interaction_type", "user"]

    def get_queryset(self):
        return OrganizationInteraction.objects.select_related(
            "organization", "user"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

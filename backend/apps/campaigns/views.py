from rest_framework import viewsets, generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Campaign, CampaignQueue, CampaignProgram,
    CampaignRegion, CampaignOrganization,
)
from .serializers import (
    CampaignListSerializer, CampaignDetailSerializer,
    CampaignCreateSerializer, CampaignQueueSerializer,
    CampaignProgramSerializer, CampaignRegionSerializer,
    CampaignOrganizationSerializer,
)


class CampaignViewSet(viewsets.ModelViewSet):
    filterset_fields = ["status", "federal_operator"]
    search_fields = ["name"]

    def get_queryset(self):
        return Campaign.objects.select_related(
            "federal_operator", "created_by"
        ).prefetch_related(
            "queues",
            "campaign_programs__program__profession",
            "campaign_regions__region__federal_district",
            "campaign_regions__queue",
            "organizations__organization__region",
        )

    def get_serializer_class(self):
        if self.action == "list":
            return CampaignListSerializer
        if self.action in ("create",):
            return CampaignCreateSerializer
        if self.action in ("update", "partial_update"):
            return CampaignCreateSerializer
        return CampaignDetailSerializer

    @action(detail=True, methods=["post"], url_path="programs")
    def add_programs(self, request, pk=None):
        campaign = self.get_object()
        program_ids = request.data.get("program_ids", [])
        created = []
        for pid in program_ids:
            obj, was_created = CampaignProgram.objects.get_or_create(
                campaign=campaign, program_id=pid,
                defaults={"manager_id": request.data.get("manager_id")},
            )
            if was_created:
                created.append(obj)
        return Response(
            CampaignProgramSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="regions")
    def add_regions(self, request, pk=None):
        campaign = self.get_object()
        regions_data = request.data.get("regions", [])
        created = []
        for rd in regions_data:
            obj, was_created = CampaignRegion.objects.get_or_create(
                campaign=campaign,
                region_id=rd["region_id"],
                defaults={
                    "queue_id": rd.get("queue_id"),
                    "manager_id": rd.get("manager_id"),
                },
            )
            if was_created:
                created.append(obj)
        return Response(
            CampaignRegionSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="organizations")
    def add_organizations(self, request, pk=None):
        campaign = self.get_object()
        org_ids = request.data.get("organization_ids", [])
        created = []
        for oid in org_ids:
            obj, was_created = CampaignOrganization.objects.get_or_create(
                campaign=campaign,
                organization_id=oid,
                defaults={"manager_id": request.data.get("manager_id")},
            )
            if was_created:
                created.append(obj)
        return Response(
            CampaignOrganizationSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="assign-managers")
    def assign_managers(self, request, pk=None):
        campaign = self.get_object()
        assignments = request.data.get("assignments", [])
        updated = 0
        for a in assignments:
            level = a.get("level")
            target_id = a.get("target_id")
            manager_id = a.get("manager_id")

            if level == "program":
                CampaignProgram.objects.filter(
                    campaign=campaign, program_id=target_id
                ).update(manager_id=manager_id)
                updated += 1
            elif level == "region":
                CampaignRegion.objects.filter(
                    campaign=campaign, region_id=target_id
                ).update(manager_id=manager_id)
                updated += 1
            elif level == "organization":
                CampaignOrganization.objects.filter(
                    campaign=campaign, organization_id=target_id
                ).update(manager_id=manager_id)
                updated += 1

        return Response({"updated": updated})


class CampaignQueueViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignQueueSerializer
    filterset_fields = ["campaign"]

    def get_queryset(self):
        return CampaignQueue.objects.all()


class CampaignOrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignOrganizationSerializer
    filterset_fields = ["campaign", "status", "manager"]

    def get_queryset(self):
        return CampaignOrganization.objects.select_related(
            "organization__region", "manager"
        )

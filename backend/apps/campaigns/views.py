from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Campaign, CampaignQueue, CampaignProgram,
    CampaignRegion, CampaignOrganization,
    QueueStageDeadline, Lead, LeadChecklistValue, LeadInteraction,
)
from .serializers import (
    CampaignListSerializer, CampaignDetailSerializer,
    CampaignCreateSerializer, CampaignQueueSerializer,
    CampaignProgramSerializer, CampaignRegionSerializer,
    CampaignOrganizationSerializer,
    QueueStageDeadlineSerializer,
    LeadListSerializer, LeadDetailSerializer,
    LeadChecklistValueSerializer, LeadInteractionSerializer,
)


class CampaignViewSet(viewsets.ModelViewSet):
    filterset_fields = ["status", "federal_operator"]
    search_fields = ["name"]

    def get_queryset(self):
        return Campaign.objects.select_related(
            "federal_operator", "created_by"
        ).prefetch_related(
            "queues__stage_deadlines",
            "campaign_funnels__funnel",
            "campaign_programs__program__profession",
            "campaign_regions__region__federal_district",
            "campaign_regions__queue",
            "organizations__organization__region",
            "leads__organization__region",
            "leads__funnel",
            "leads__current_stage",
            "leads__queue",
            "leads__manager",
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

    @action(detail=True, methods=["post"], url_path="leads")
    def add_leads(self, request, pk=None):
        campaign = self.get_object()
        lead_data = request.data.get("leads", [])
        first_queue = campaign.queues.order_by("queue_number").first()
        created = []
        for ld in lead_data:
            queue_id = ld.get("queue_id") or (first_queue.id if first_queue else None)
            obj, was_created = Lead.objects.get_or_create(
                campaign=campaign,
                organization_id=ld["organization_id"],
                funnel_id=ld["funnel_id"],
                defaults={
                    "queue_id": queue_id,
                    "manager_id": ld.get("manager_id"),
                    "forecast_demand": ld.get("forecast_demand"),
                },
            )
            if was_created:
                created.append(obj)
        return Response(
            LeadListSerializer(created, many=True).data,
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
            elif level == "lead":
                Lead.objects.filter(
                    campaign=campaign, id=target_id
                ).update(manager_id=manager_id)
                updated += 1

        return Response({"updated": updated})


class CampaignQueueViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignQueueSerializer
    filterset_fields = ["campaign"]

    def get_queryset(self):
        return CampaignQueue.objects.all()

    @action(detail=True, methods=["get", "post"], url_path="stage-deadlines")
    def stage_deadlines(self, request, pk=None):
        queue = self.get_object()
        if request.method == "GET":
            deadlines = queue.stage_deadlines.select_related("funnel_stage")
            serializer = QueueStageDeadlineSerializer(deadlines, many=True)
            return Response(serializer.data)

        serializer = QueueStageDeadlineSerializer(
            data={**request.data, "queue": queue.pk}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CampaignOrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignOrganizationSerializer
    filterset_fields = ["campaign", "status", "manager"]

    def get_queryset(self):
        return CampaignOrganization.objects.select_related(
            "organization__region", "manager"
        )


class LeadViewSet(viewsets.ModelViewSet):
    filterset_fields = ["campaign", "funnel", "queue", "manager", "current_stage"]
    search_fields = ["organization__name"]

    def get_queryset(self):
        return Lead.objects.select_related(
            "organization__region", "funnel", "current_stage",
            "queue", "manager",
        ).prefetch_related(
            "checklist_values__checklist_item",
            "interactions",
        )

    def get_serializer_class(self):
        if self.action == "list":
            return LeadListSerializer
        return LeadDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.current_stage:
            self._ensure_checklist_values(instance, instance.current_stage)
            instance = self.get_queryset().get(pk=instance.pk)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="checklist")
    def checklist(self, request, pk=None):
        lead = self.get_object()
        if request.method == "GET":
            values = lead.checklist_values.select_related("checklist_item")
            serializer = LeadChecklistValueSerializer(values, many=True)
            return Response(serializer.data)

        data = {**request.data, "lead": lead.pk}
        if request.data.get("is_completed"):
            data["completed_at"] = timezone.now().isoformat()
            data["completed_by"] = request.user.pk
        serializer = LeadChecklistValueSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="checklist/(?P<value_id>[^/.]+)/toggle")
    def toggle_checklist(self, request, pk=None, value_id=None):
        lead = self.get_object()
        try:
            value = lead.checklist_values.get(pk=value_id)
        except LeadChecklistValue.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        value.is_completed = not value.is_completed
        if value.is_completed:
            value.completed_at = timezone.now()
            value.completed_by = request.user
        else:
            value.completed_at = None
            value.completed_by = None
        value.save()
        return Response(LeadChecklistValueSerializer(value).data)

    @action(detail=True, methods=["patch"], url_path="checklist/(?P<value_id>[^/.]+)/update")
    def update_checklist_value(self, request, pk=None, value_id=None):
        lead = self.get_object()
        try:
            value = lead.checklist_values.get(pk=value_id)
        except LeadChecklistValue.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        updatable = [
            "text_value", "select_value",
            "contact_name", "contact_position", "contact_phone",
            "contact_email", "contact_messenger",
        ]
        for field in updatable:
            if field in request.data:
                setattr(value, field, request.data[field])
        value.save()
        return Response(LeadChecklistValueSerializer(value).data)

    @action(detail=True, methods=["get", "post"], url_path="interactions")
    def interactions(self, request, pk=None):
        lead = self.get_object()
        if request.method == "GET":
            interactions = lead.interactions.select_related("created_by")
            serializer = LeadInteractionSerializer(interactions, many=True)
            return Response(serializer.data)

        serializer = LeadInteractionSerializer(
            data={**request.data, "lead": lead.pk}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="advance-stage")
    def advance_stage(self, request, pk=None):
        lead = self.get_object()
        normal_stages = list(
            lead.funnel.stages.filter(is_rejection=False).order_by("order")
        )
        if not normal_stages:
            return Response({"detail": "No stages in funnel"}, status=status.HTTP_400_BAD_REQUEST)

        if lead.current_stage is None or lead.current_stage.is_rejection:
            lead.current_stage = normal_stages[0]
        else:
            current_idx = next(
                (i for i, s in enumerate(normal_stages) if s.id == lead.current_stage_id),
                -1,
            )
            if current_idx < len(normal_stages) - 1:
                lead.current_stage = normal_stages[current_idx + 1]
            else:
                return Response(
                    {"detail": "Already at last stage"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        lead.save(update_fields=["current_stage", "updated_at"])
        self._ensure_checklist_values(lead, lead.current_stage)
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        lead = self.get_object()
        rejection_stage = lead.funnel.stages.filter(is_rejection=True).first()
        if not rejection_stage:
            return Response(
                {"detail": "No rejection stage in funnel"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        lead.current_stage = rejection_stage
        lead.save(update_fields=["current_stage", "updated_at"])
        self._ensure_checklist_values(lead, lead.current_stage)
        return Response(LeadDetailSerializer(lead).data)

    @staticmethod
    def _ensure_checklist_values(lead, stage):
        """Create LeadChecklistValue for each StageChecklistItem that doesn't have one yet."""
        if not stage:
            return
        for item in stage.checklist_items.all():
            LeadChecklistValue.objects.get_or_create(
                lead=lead, checklist_item=item,
            )

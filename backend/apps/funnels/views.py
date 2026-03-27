from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Funnel, FunnelStage, StageChecklistItem, ChecklistItemOption
from .serializers import (
    FunnelListSerializer,
    FunnelDetailSerializer,
    FunnelCreateSerializer,
    FunnelStageSerializer,
    StageChecklistItemSerializer,
    ChecklistItemOptionSerializer,
)


class FunnelViewSet(viewsets.ModelViewSet):
    filterset_fields = ["is_active"]
    search_fields = ["name"]

    def get_queryset(self):
        return Funnel.objects.prefetch_related(
            "stages__checklist_items__options"
        )

    def get_serializer_class(self):
        if self.action == "list":
            return FunnelListSerializer
        if self.action in ("create", "update", "partial_update"):
            return FunnelCreateSerializer
        return FunnelDetailSerializer

    @action(detail=True, methods=["get", "post"], url_path="stages")
    def stages(self, request, pk=None):
        funnel = self.get_object()
        if request.method == "GET":
            stages = funnel.stages.prefetch_related("checklist_items__options")
            serializer = FunnelStageSerializer(stages, many=True)
            return Response(serializer.data)

        serializer = FunnelStageSerializer(data={**request.data, "funnel": funnel.pk})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FunnelStageViewSet(viewsets.ModelViewSet):
    serializer_class = FunnelStageSerializer
    filterset_fields = ["funnel"]

    def get_queryset(self):
        return FunnelStage.objects.select_related("funnel").prefetch_related(
            "checklist_items__options"
        )

    @action(detail=True, methods=["get", "post"], url_path="checklist")
    def checklist(self, request, pk=None):
        stage = self.get_object()
        if request.method == "GET":
            items = stage.checklist_items.prefetch_related("options")
            serializer = StageChecklistItemSerializer(items, many=True)
            return Response(serializer.data)

        serializer = StageChecklistItemSerializer(
            data={**request.data, "stage": stage.pk}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class StageChecklistItemViewSet(viewsets.ModelViewSet):
    serializer_class = StageChecklistItemSerializer
    filterset_fields = ["stage"]

    def get_queryset(self):
        return StageChecklistItem.objects.select_related("stage").prefetch_related(
            "options"
        )

    @action(detail=True, methods=["get", "post"], url_path="options")
    def options(self, request, pk=None):
        item = self.get_object()
        if request.method == "GET":
            opts = item.options.all()
            serializer = ChecklistItemOptionSerializer(opts, many=True)
            return Response(serializer.data)

        serializer = ChecklistItemOptionSerializer(
            data={**request.data, "checklist_item": item.pk}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChecklistItemOptionViewSet(viewsets.ModelViewSet):
    serializer_class = ChecklistItemOptionSerializer
    filterset_fields = ["checklist_item"]

    def get_queryset(self):
        return ChecklistItemOption.objects.select_related("checklist_item")

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Funnel,
    FunnelStage,
    StageChecklistItem,
    ChecklistItemOption,
    SubfunnelTemplate,
    TaskTemplateStage,
    SubfunnelTemplateItem,
    SubfunnelTemplateBinding,
)
from .serializers import (
    FunnelListSerializer,
    FunnelDetailSerializer,
    FunnelCreateSerializer,
    FunnelStageSerializer,
    StageChecklistItemSerializer,
    ChecklistItemOptionSerializer,
    SubfunnelTemplateSerializer,
    TaskTemplateStageSerializer,
    SubfunnelTemplateItemSerializer,
    SubfunnelTemplateBindingSerializer,
)


class FunnelViewSet(viewsets.ModelViewSet):
    filterset_fields = ["is_active"]
    search_fields = ["name"]

    def get_queryset(self):
        qs = Funnel.objects.prefetch_related(
            "stages__checklist_items__options",
            "tags",
        )
        tag_ids = self.request.query_params.get("tags")
        if tag_ids:
            ids = [int(x) for x in tag_ids.split(",") if x.strip().isdigit()]
            if ids:
                qs = qs.filter(tags__id__in=ids).distinct()
        return qs

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

    @action(detail=True, methods=["get", "post"], url_path="subfunnel-bindings")
    def subfunnel_bindings(self, request, pk=None):
        funnel = self.get_object()
        if request.method == "GET":
            bindings = funnel.subfunnel_bindings.select_related(
                "template", "role", "default_specialist"
            )
            serializer = SubfunnelTemplateBindingSerializer(bindings, many=True)
            return Response(serializer.data)
        serializer = SubfunnelTemplateBindingSerializer(
            data={**request.data, "funnel": funnel.pk}
        )
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


class SubfunnelTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = SubfunnelTemplateSerializer
    filterset_fields = ["is_active", "owner_role"]
    search_fields = ["name", "slug"]

    def get_queryset(self):
        return SubfunnelTemplate.objects.select_related("owner_role").prefetch_related("items", "stages")

    @action(detail=True, methods=["get", "post"], url_path="stages")
    def stages(self, request, pk=None):
        template = self.get_object()
        if request.method == "GET":
            stages = template.stages.order_by("order", "id")
            serializer = TaskTemplateStageSerializer(stages, many=True)
            return Response(serializer.data)
        serializer = TaskTemplateStageSerializer(data={**request.data, "template": template.pk})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="items")
    def items(self, request, pk=None):
        template = self.get_object()
        if request.method == "GET":
            items = template.items.select_related("default_role", "default_specialist")
            serializer = SubfunnelTemplateItemSerializer(items, many=True)
            return Response(serializer.data)
        serializer = SubfunnelTemplateItemSerializer(
            data={**request.data, "template": template.pk}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SubfunnelTemplateItemViewSet(viewsets.ModelViewSet):
    serializer_class = SubfunnelTemplateItemSerializer
    filterset_fields = ["template"]

    def get_queryset(self):
        return SubfunnelTemplateItem.objects.select_related(
            "template", "stage", "default_role", "default_specialist"
        )


class TaskTemplateStageViewSet(viewsets.ModelViewSet):
    serializer_class = TaskTemplateStageSerializer
    filterset_fields = ["template", "is_terminal"]

    def get_queryset(self):
        return TaskTemplateStage.objects.select_related("template").order_by("order", "id")


class SubfunnelTemplateBindingViewSet(viewsets.ModelViewSet):
    serializer_class = SubfunnelTemplateBindingSerializer
    filterset_fields = ["funnel", "template", "binding_type", "is_active"]

    def get_queryset(self):
        return SubfunnelTemplateBinding.objects.select_related(
            "funnel",
            "template",
            "role",
            "default_specialist",
            "target_stage",
            "target_checklist_item",
            "from_stage",
            "to_stage",
        )

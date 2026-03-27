from rest_framework import serializers
from .models import Funnel, FunnelStage, StageChecklistItem, ChecklistItemOption


class ChecklistItemOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItemOption
        fields = ["id", "checklist_item", "value", "order"]
        read_only_fields = ["id"]


class StageChecklistItemSerializer(serializers.ModelSerializer):
    options = ChecklistItemOptionSerializer(many=True, read_only=True)
    confirmation_type_display = serializers.CharField(
        source="get_confirmation_type_display", read_only=True
    )

    class Meta:
        model = StageChecklistItem
        fields = [
            "id", "stage", "text", "order",
            "confirmation_type", "confirmation_type_display",
            "options",
        ]
        read_only_fields = ["id"]


class FunnelStageSerializer(serializers.ModelSerializer):
    checklist_items = StageChecklistItemSerializer(many=True, read_only=True)

    class Meta:
        model = FunnelStage
        fields = [
            "id", "funnel", "name", "order",
            "deadline_days", "is_rejection", "checklist_items",
        ]
        read_only_fields = ["id"]


class FunnelListSerializer(serializers.ModelSerializer):
    stages_count = serializers.SerializerMethodField()

    class Meta:
        model = Funnel
        fields = [
            "id", "name", "description", "is_active",
            "stages_count", "created_at", "updated_at",
        ]

    def get_stages_count(self, obj):
        return obj.stages.count()


class FunnelDetailSerializer(serializers.ModelSerializer):
    stages = FunnelStageSerializer(many=True, read_only=True)

    class Meta:
        model = Funnel
        fields = [
            "id", "name", "description", "is_active",
            "stages", "created_at", "updated_at",
        ]


class FunnelCreateSerializer(serializers.ModelSerializer):
    description = serializers.CharField(required=False, allow_blank=True, default="")
    is_active = serializers.BooleanField(required=False, default=True)

    class Meta:
        model = Funnel
        fields = ["id", "name", "description", "is_active"]
        read_only_fields = ["id"]

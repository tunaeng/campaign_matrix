from rest_framework import serializers
from .models import Funnel, FunnelStage, StageChecklistItem, ChecklistItemOption


class ChecklistItemOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItemOption
        fields = ["id", "checklist_item", "value", "order"]
        read_only_fields = ["id"]


class StageChecklistItemSerializer(serializers.ModelSerializer):
    options = ChecklistItemOptionSerializer(many=True, read_only=True)
    confirmation_types_display = serializers.SerializerMethodField()

    class Meta:
        model = StageChecklistItem
        fields = [
            "id", "stage", "text", "order",
            "confirmation_types", "confirmation_types_display",
            "options",
        ]
        read_only_fields = ["id"]

    def get_confirmation_types_display(self, obj):
        return obj.get_confirmation_types_display_list()

    def validate_confirmation_types(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Ожидается список строк.")
        allowed = {
            c[0]
            for c in StageChecklistItem.ConfirmationType.choices
            if c[0] != StageChecklistItem.ConfirmationType.NONE
        }
        seen = set()
        for t in value:
            if t not in allowed:
                raise serializers.ValidationError(f"Недопустимый тип: {t!r}.")
            if t in seen:
                raise serializers.ValidationError("Типы не должны повторяться.")
            seen.add(t)
        return value


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

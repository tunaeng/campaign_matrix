from rest_framework import serializers
from apps.organizations.models import OrganizationTag
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


class ChecklistItemOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItemOption
        fields = ["id", "checklist_item", "value", "order"]
        read_only_fields = ["id"]


class StageChecklistItemSerializer(serializers.ModelSerializer):
    options = ChecklistItemOptionSerializer(many=True, read_only=True)
    confirmation_types_display = serializers.SerializerMethodField()
    primary_contact_specialist_name = serializers.SerializerMethodField()
    communication_step_display = serializers.SerializerMethodField()

    class Meta:
        model = StageChecklistItem
        fields = [
            "id", "stage", "text", "order",
            "confirmation_types", "confirmation_types_display",
            "primary_contact_specialist", "primary_contact_specialist_name",
            "communication_step", "communication_step_display",
            "options",
        ]
        read_only_fields = ["id"]

    def get_confirmation_types_display(self, obj):
        return obj.get_confirmation_types_display_list()

    def get_primary_contact_specialist_name(self, obj):
        return str(obj.primary_contact_specialist) if obj.primary_contact_specialist else None

    def get_communication_step_display(self, obj):
        return obj.get_communication_step_display()

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

    def validate_communication_step(self, value):
        allowed = {c[0] for c in StageChecklistItem.CommunicationStep.choices}
        if value not in allowed:
            raise serializers.ValidationError("Недопустимый шаг коммуникации.")
        return value


class FunnelStageSerializer(serializers.ModelSerializer):
    checklist_items = StageChecklistItemSerializer(many=True, read_only=True)
    primary_contact_specialist_name = serializers.SerializerMethodField()

    class Meta:
        model = FunnelStage
        fields = [
            "id", "funnel", "name", "order",
            "deadline_days", "is_rejection", "is_collect_stage",
            "responsible_role",
            "selection_mode", "search_task",
            "primary_contact_specialist", "primary_contact_specialist_name",
            "checklist_items",
        ]
        read_only_fields = ["id"]

    def get_primary_contact_specialist_name(self, obj):
        return str(obj.primary_contact_specialist) if obj.primary_contact_specialist else None

    def validate(self, attrs):
        is_rejection = attrs.get("is_rejection", getattr(self.instance, "is_rejection", False))
        is_collect_stage = attrs.get("is_collect_stage", getattr(self.instance, "is_collect_stage", False))
        selection_mode = attrs.get("selection_mode", getattr(self.instance, "selection_mode", ""))
        if is_rejection and is_collect_stage:
            raise serializers.ValidationError(
                "Стадия отказа не может одновременно быть стадией сбора лидов."
            )
        if is_collect_stage and selection_mode != FunnelStage.SelectionMode.REGIONS:
            raise serializers.ValidationError(
                {"selection_mode": "Для стадии сбора лидов доступен только отбор по регионам."}
            )
        if not is_collect_stage and selection_mode:
            raise serializers.ValidationError(
                {"selection_mode": "Режим отбора доступен только для стадии сбора лидов."}
            )
        return attrs


class FunnelListSerializer(serializers.ModelSerializer):
    stages_count = serializers.SerializerMethodField()
    tags = serializers.PrimaryKeyRelatedField(
        many=True, queryset=OrganizationTag.objects.all(), required=False,
    )
    tag_names = serializers.SerializerMethodField()

    class Meta:
        model = Funnel
        fields = [
            "id", "name", "description", "is_active",
            "stages_count", "tags", "tag_names",
            "created_at", "updated_at",
        ]

    def get_stages_count(self, obj):
        return obj.stages.count()

    def get_tag_names(self, obj):
        return list(obj.tags.order_by("name").values_list("name", flat=True))


class FunnelDetailSerializer(serializers.ModelSerializer):
    stages = FunnelStageSerializer(many=True, read_only=True)
    tags = serializers.PrimaryKeyRelatedField(
        many=True, queryset=OrganizationTag.objects.all(), required=False,
    )
    tag_names = serializers.SerializerMethodField()

    class Meta:
        model = Funnel
        fields = [
            "id", "name", "description", "is_active",
            "tags", "tag_names",
            "stages", "created_at", "updated_at",
        ]

    def get_tag_names(self, obj):
        return list(obj.tags.order_by("name").values_list("name", flat=True))


class FunnelCreateSerializer(serializers.ModelSerializer):
    description = serializers.CharField(required=False, allow_blank=True, default="")
    is_active = serializers.BooleanField(required=False, default=True)
    tags = serializers.PrimaryKeyRelatedField(
        many=True, queryset=OrganizationTag.objects.all(), required=False,
    )

    class Meta:
        model = Funnel
        fields = ["id", "name", "description", "is_active", "tags"]
        read_only_fields = ["id"]


class TaskTemplateStageSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        template = attrs.get("template") or getattr(self.instance, "template", None)
        is_terminal = attrs.get("is_terminal", getattr(self.instance, "is_terminal", False))
        if template and is_terminal:
            qs = template.stages.filter(is_terminal=True)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"is_terminal": "В шаблоне может быть только один terminal-этап."})
        return attrs

    class Meta:
        model = TaskTemplateStage
        fields = [
            "id",
            "template",
            "name",
            "order",
            "is_terminal",
            "sla_days",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SubfunnelTemplateItemSerializer(serializers.ModelSerializer):
    default_role_name = serializers.CharField(source="default_role.name", read_only=True)
    default_specialist_name = serializers.SerializerMethodField()
    stage_name = serializers.CharField(source="stage.name", read_only=True)

    class Meta:
        model = SubfunnelTemplateItem
        fields = [
            "id",
            "template",
            "title",
            "order",
            "execution_type",
            "stage",
            "stage_name",
            "default_role",
            "default_role_name",
            "default_specialist",
            "default_specialist_name",
        ]
        read_only_fields = ["id"]

    def get_default_specialist_name(self, obj):
        return str(obj.default_specialist) if obj.default_specialist else None

    def validate(self, attrs):
        template = attrs.get("template") or getattr(self.instance, "template", None)
        stage = attrs.get("stage", getattr(self.instance, "stage", None))
        if stage and template and stage.template_id != template.id:
            raise serializers.ValidationError({"stage": "Этап должен принадлежать выбранному шаблону задачи."})
        return attrs


class SubfunnelTemplateSerializer(serializers.ModelSerializer):
    owner_role_name = serializers.CharField(source="owner_role.name", read_only=True)
    items = SubfunnelTemplateItemSerializer(many=True, read_only=True)
    stages = TaskTemplateStageSerializer(many=True, read_only=True)

    class Meta:
        model = SubfunnelTemplate
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "owner_role",
            "owner_role_name",
            "is_active",
            "version",
            "stages",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SubfunnelTemplateBindingSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="template.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    default_specialist_name = serializers.SerializerMethodField()

    class Meta:
        model = SubfunnelTemplateBinding
        fields = [
            "id",
            "funnel",
            "template",
            "template_name",
            "binding_type",
            "target_stage",
            "target_checklist_item",
            "from_stage",
            "to_stage",
            "role",
            "role_name",
            "default_specialist",
            "default_specialist_name",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_default_specialist_name(self, obj):
        return str(obj.default_specialist) if obj.default_specialist else None

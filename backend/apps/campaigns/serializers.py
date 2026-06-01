import os
import random

from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.db.utils import OperationalError, ProgrammingError
from rest_framework import serializers
from apps.organizations.models import Contact, OrganizationTag
from apps.funnels.models import TaskTemplateStage
from .models import (
    Campaign, CampaignQueue, CampaignProgram,
    CampaignRegion, CampaignOrganization,
    CampaignFunnel, QueueStageDeadline,
    Lead, LeadChecklistValue, LeadChecklistAttachment, LeadInteraction,
    CampaignSubfunnel, LeadSubfunnel, LeadSubfunnelChecklistValue,
)
from apps.accounts.serializers import UserShortSerializer


def serialize_contact_brief(contact):
    if not contact:
        return None
    return {
        "id": contact.id,
        "full_name": contact.full_name,
        "type": contact.type,
        "type_display": contact.get_type_display(),
        "position": contact.position or "",
        "phone": contact.phone or "",
        "email": contact.email or "",
        "department_name": contact.department_name or "",
        "messenger": contact.messenger or "",
        "comment": contact.comment or "",
    }


def extract_forwarded_from_notes(notes):
    first_line = ((notes or "").splitlines() or [""])[0].strip()
    prefix = "Передано от организации:"
    if not first_line.startswith(prefix):
        return None
    value = first_line[len(prefix):].strip()
    if ". Комментарий:" in value:
        value = value.split(". Комментарий:", 1)[0].strip()
    return value or None


class CampaignQueueSerializer(serializers.ModelSerializer):
    stage_deadlines = serializers.SerializerMethodField()

    class Meta:
        model = CampaignQueue
        fields = [
            "id", "campaign", "queue_number", "name",
            "start_date", "end_date", "stage_deadlines",
        ]
        read_only_fields = ["id"]

    def get_stage_deadlines(self, obj):
        return QueueStageDeadlineSerializer(
            obj.stage_deadlines.select_related("funnel_stage").order_by("funnel_stage__order"),
            many=True,
        ).data


class CampaignQueueWriteSerializer(serializers.Serializer):
    queue_number = serializers.IntegerField()
    name = serializers.CharField(max_length=200, required=False, default="")
    start_date = serializers.DateField(required=False, allow_null=True, default=None)
    end_date = serializers.DateField(required=False, allow_null=True, default=None)


class QueueStageDeadlineSerializer(serializers.ModelSerializer):
    stage_name = serializers.CharField(source="funnel_stage.name", read_only=True)

    class Meta:
        model = QueueStageDeadline
        fields = ["id", "queue", "funnel_stage", "stage_name", "deadline_days"]
        read_only_fields = ["id"]


class CampaignFunnelSerializer(serializers.ModelSerializer):
    funnel_name = serializers.CharField(source="funnel.name", read_only=True)

    class Meta:
        model = CampaignFunnel
        fields = ["id", "campaign", "funnel", "funnel_name"]
        read_only_fields = ["id"]


class CampaignProgramSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(
        source="program.name", read_only=True
    )
    profession_name = serializers.CharField(
        source="program.profession.name", read_only=True
    )
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = CampaignProgram
        fields = [
            "id", "campaign", "program", "program_name",
            "profession_name", "manager", "manager_name",
        ]
        read_only_fields = ["id"]

    def get_manager_name(self, obj):
        if obj.manager:
            return str(obj.manager)
        return None


class CampaignRegionSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(
        source="region.name", read_only=True
    )
    federal_district_name = serializers.CharField(
        source="region.federal_district.name", read_only=True
    )
    queue_name = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()
    primary_contact_specialist_name = serializers.SerializerMethodField()

    class Meta:
        model = CampaignRegion
        fields = [
            "id", "campaign", "region", "region_name",
            "federal_district_name", "queue", "queue_name",
            "manager", "manager_name",
            "primary_contact_specialist", "primary_contact_specialist_name",
            "demand_quota", "search_task",
        ]
        read_only_fields = ["id"]

    def get_queue_name(self, obj):
        if obj.queue:
            return str(obj.queue)
        return None

    def get_manager_name(self, obj):
        if obj.manager:
            return str(obj.manager)
        return None

    def get_primary_contact_specialist_name(self, obj):
        if obj.primary_contact_specialist:
            return str(obj.primary_contact_specialist)
        return None


class CampaignOrganizationSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(
        source="organization.name", read_only=True
    )
    organization_region = serializers.CharField(
        source="organization.region.name", read_only=True, default=None
    )
    organization_type = serializers.CharField(
        source="organization.get_org_type_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    manager_name = serializers.SerializerMethodField()
    primary_contact_preview = serializers.SerializerMethodField()
    organization_tags = serializers.SerializerMethodField()

    class Meta:
        model = CampaignOrganization
        fields = [
            "id", "campaign", "organization", "organization_name",
            "organization_region", "organization_type",
            "status", "status_display", "manager", "manager_name",
            "demand_count", "notes", "primary_contact_preview",
            "organization_tags",
        ]
        read_only_fields = ["id"]

    def get_organization_tags(self, obj):
        return [t.pk for t in obj.organization.tags.all()]

    def get_manager_name(self, obj):
        if obj.manager:
            return str(obj.manager)
        return None

    def get_primary_contact_preview(self, obj):
        lead = (
            Lead.objects.filter(
                campaign=obj.campaign,
                organization=obj.organization,
                primary_contact__isnull=False,
            )
            .select_related("primary_contact", "funnel")
            .first()
        )
        if not lead:
            return None
        return {
            "lead_id": lead.id,
            "funnel_name": lead.funnel.name if lead.funnel else None,
            "contact": serialize_contact_brief(lead.primary_contact),
        }


# Lead serializers

class LeadChecklistAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()

    class Meta:
        model = LeadChecklistAttachment
        fields = ["id", "url", "filename", "order"]

    def get_url(self, obj):
        if not obj.file:
            return None
        url = obj.file.url
        if url.startswith("http://") or url.startswith("https://"):
            return url
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_filename(self, obj):
        if not obj.file:
            return ""
        return os.path.basename(obj.file.name)


class LeadChecklistValueSerializer(serializers.ModelSerializer):
    checklist_item_text = serializers.CharField(
        source="checklist_item.text", read_only=True
    )
    confirmation_types = serializers.SerializerMethodField()
    confirmation_types_display = serializers.SerializerMethodField()
    stage_id = serializers.IntegerField(
        source="checklist_item.stage_id", read_only=True
    )
    options = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()
    file_value = serializers.SerializerMethodField()
    contact_full_name = serializers.CharField(
        source="contact.full_name", read_only=True, default=None
    )
    primary_contact_specialist_name = serializers.SerializerMethodField()
    communication_step = serializers.CharField(
        source="checklist_item.communication_step", read_only=True, default=""
    )
    communication_step_display = serializers.CharField(
        source="checklist_item.get_communication_step_display",
        read_only=True,
        default="",
    )

    class Meta:
        model = LeadChecklistValue
        fields = [
            "id", "lead", "checklist_item", "checklist_item_text",
            "confirmation_types", "confirmation_types_display", "stage_id", "options", "is_completed",
            "text_value", "files", "file_value", "select_value",
            "contact", "contact_full_name",
            "contact_name", "contact_position", "contact_phone",
            "contact_email", "contact_messenger",
            "primary_contact_specialist", "primary_contact_specialist_name",
            "communication_step", "communication_step_display",
            "completed_at", "completed_by",
        ]
        read_only_fields = ["id", "completed_at", "completed_by"]

    def get_primary_contact_specialist_name(self, obj):
        if obj.primary_contact_specialist:
            return str(obj.primary_contact_specialist)
        return None

    def get_confirmation_types(self, obj):
        return list(obj.checklist_item.confirmation_types or [])

    def get_confirmation_types_display(self, obj):
        return obj.checklist_item.get_confirmation_types_display_list()

    def get_options(self, obj):
        if "select" not in (obj.checklist_item.confirmation_types or []):
            return []
        return list(
            obj.checklist_item.options.order_by("order").values_list("value", flat=True)
        )

    def _abs_url_for_fieldfile(self, file_field):
        if not file_field:
            return None
        url = file_field.url
        if url.startswith("http://") or url.startswith("https://"):
            return url
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_files(self, obj):
        atts = obj.attachments.all()
        if atts.exists():
            return LeadChecklistAttachmentSerializer(
                atts, many=True, context=self.context
            ).data
        if obj.file_value:
            return [
                {
                    "id": None,
                    "url": self._abs_url_for_fieldfile(obj.file_value),
                    "filename": os.path.basename(obj.file_value.name),
                    "order": 0,
                }
            ]
        return []

    def get_file_value(self, obj):
        """Первый файл (совместимость со старым фронтом)."""
        first = obj.attachments.first()
        if first and first.file:
            return self._abs_url_for_fieldfile(first.file)
        return self._abs_url_for_fieldfile(obj.file_value) if obj.file_value else None


class LeadInteractionSerializer(serializers.ModelSerializer):
    channel_display = serializers.CharField(
        source="get_channel_display", read_only=True
    )
    created_by_name = serializers.SerializerMethodField()
    contact_full_name = serializers.CharField(
        source="contact.full_name", read_only=True, default=None
    )
    contact_position_from_ref = serializers.CharField(
        source="contact.position", read_only=True, default=None
    )

    class Meta:
        model = LeadInteraction
        fields = [
            "id", "lead", "contact", "contact_full_name",
            "contact_person", "contact_position", "contact_position_from_ref",
            "date", "channel", "channel_display", "result",
            "created_by", "created_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return str(obj.created_by)
        return None

    def create(self, validated_data):
        contact = validated_data.get("contact")
        cp = validated_data.get("contact_person")
        if contact and not (cp and str(cp).strip()):
            validated_data["contact_person"] = (contact.full_name or "").strip() or str(
                contact
            )
        return super().create(validated_data)


class LeadListSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(
        source="organization.name", read_only=True
    )
    organization_region = serializers.SerializerMethodField()
    region_name = serializers.CharField(source="region.name", read_only=True, default=None)
    funnel_name = serializers.CharField(
        source="funnel.name", read_only=True
    )
    current_stage_name = serializers.CharField(
        source="current_stage.name", read_only=True, default=None
    )
    current_stage_is_rejection = serializers.BooleanField(
        source="current_stage.is_rejection", read_only=True, default=False
    )
    queue_name = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()
    primary_contact_specialist_name = serializers.SerializerMethodField()
    checklist_progress = serializers.SerializerMethodField()
    checklist_summary = serializers.SerializerMethodField()
    tasks_summary = serializers.SerializerMethodField()
    last_interaction = serializers.SerializerMethodField()
    primary_contact = serializers.SerializerMethodField()
    tags = serializers.PrimaryKeyRelatedField(
        many=True, queryset=OrganizationTag.objects.all(), required=False,
    )
    tag_names = serializers.SerializerMethodField()
    organization_tags = serializers.SerializerMethodField()
    forwarded_from = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            "id", "campaign", "organization", "organization_name",
            "region", "region_name", "organization_region",
            "funnel", "funnel_name",
            "queue", "queue_name",
            "current_stage", "current_stage_name", "current_stage_is_rejection",
            "manager", "manager_name",
            "primary_contact_specialist", "primary_contact_specialist_name",
            "primary_contact_status", "primary_contact_result",
            "forecast_demand", "demand_count",
            "demand_collected_declared", "demand_collected_list",
            "demand_quota_declared", "demand_quota_list",
            "notes",
            "forwarded_from",
            "tags", "tag_names", "organization_tags",
            "checklist_progress", "checklist_summary", "tasks_summary", "last_interaction",
            "primary_contact",
            "created_at", "updated_at",
        ]

    def get_tag_names(self, obj):
        return list(obj.tags.order_by("name").values_list("name", flat=True))

    def get_organization_tags(self, obj):
        if not obj.organization_id:
            return []
        return [t.pk for t in obj.organization.tags.all()]

    def get_organization_region(self, obj):
        if obj.region_id and obj.region:
            return obj.region.name
        if obj.organization and obj.organization.region:
            return obj.organization.region.name
        return None

    def get_queue_name(self, obj):
        if obj.queue:
            return str(obj.queue)
        return None

    def get_manager_name(self, obj):
        if obj.manager:
            return str(obj.manager)
        return None

    def get_primary_contact_specialist_name(self, obj):
        if obj.primary_contact_specialist:
            return str(obj.primary_contact_specialist)
        return None

    def get_checklist_progress(self, obj):
        if not obj.current_stage:
            return None
        total = obj.current_stage.checklist_items.count()
        completed = obj.checklist_values.filter(
            checklist_item__stage=obj.current_stage,
            is_completed=True,
        ).count()
        return {"total": total, "completed": completed}

    def get_checklist_summary(self, obj):
        if not obj.current_stage:
            return []
        items = obj.current_stage.checklist_items.order_by("order")
        completed_ids = set(
            obj.checklist_values.filter(
                checklist_item__stage=obj.current_stage,
                is_completed=True,
            ).values_list("checklist_item_id", flat=True)
        )
        return [
            {"text": item.text, "done": item.id in completed_ids}
            for item in items
        ]

    def get_tasks_summary(self, obj):
        rows = obj.subfunnels.select_related(
            "campaign_subfunnel__template",
            "current_template_stage",
        ).prefetch_related("checklist_values")
        result = []
        for row in rows:
            if not row.is_available:
                continue
            values = list(row.checklist_values.all())
            total = len(values)
            completed = sum(1 for v in values if v.is_completed)
            result.append({
                "id": row.id,
                "template_name": row.campaign_subfunnel.template.name,
                "stage_name": row.current_template_stage.name if row.current_template_stage else None,
                "status": row.status,
                "done": completed == total and total > 0,
                "progress": {"total": total, "completed": completed},
            })
        return result

    def get_last_interaction(self, obj):
        interaction = obj.interactions.order_by("-date").first()
        if not interaction:
            return None
        return {
            "contact_person": interaction.contact_person,
            "date": interaction.date.isoformat() if interaction.date else None,
            "channel": interaction.get_channel_display(),
            "result": interaction.result[:120] if interaction.result else "",
        }

    def get_primary_contact(self, obj):
        return serialize_contact_brief(obj.primary_contact)

    def get_forwarded_from(self, obj):
        return extract_forwarded_from_notes(obj.notes)


class LeadDetailSerializer(LeadListSerializer):
    primary_contact = serializers.PrimaryKeyRelatedField(
        queryset=Contact.objects.all(),
        allow_null=True,
        required=False,
    )
    checklist_values = LeadChecklistValueSerializer(many=True, read_only=True)
    interactions = LeadInteractionSerializer(many=True, read_only=True)
    stage_deadlines = serializers.SerializerMethodField()
    subfunnels = serializers.SerializerMethodField()

    class Meta(LeadListSerializer.Meta):
        fields = LeadListSerializer.Meta.fields + [
            "checklist_values", "interactions", "stage_deadlines", "subfunnels",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["primary_contact"] = serialize_contact_brief(instance.primary_contact)
        return data

    def validate_primary_contact(self, value):
        if value is None:
            return None
        lead = self.instance
        if lead and value.organization_id != lead.organization_id:
            raise serializers.ValidationError(
                "Контакт должен принадлежать организации лида"
            )
        return value

    def validate_current_stage(self, value):
        if value is None:
            return None
        lead = self.instance
        if lead and value.funnel_id != lead.funnel_id:
            raise serializers.ValidationError(
                "Стадия не принадлежит воронке лида"
            )
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        if "primary_contact" in validated_data:
            pc = validated_data.get("primary_contact")
            if pc is not None:
                Lead.objects.filter(
                    organization_id=instance.organization_id
                ).exclude(pk=instance.pk).update(primary_contact_id=None)
        return super().update(instance, validated_data)

    def get_stage_deadlines(self, obj):
        if not obj.funnel:
            return []
        stages = obj.funnel.stages.order_by("order")
        result = []
        for stage in stages:
            deadline_date = obj.get_stage_deadline(stage)
            result.append({
                "stage_id": stage.id,
                "stage_name": stage.name,
                "order": stage.order,
                "deadline_days": stage.deadline_days,
                "deadline_date": deadline_date.isoformat() if deadline_date else None,
                "is_rejection": stage.is_rejection,
                "is_collect_stage": stage.is_collect_stage,
            })
        return result

    def get_subfunnels(self, obj):
        data = obj.subfunnels.select_related(
            "campaign_subfunnel__template",
            "campaign_subfunnel__role",
            "assignee",
        ).prefetch_related("checklist_values__template_item", "checklist_values__assignee")
        return LeadSubfunnelSerializer(data, many=True).data


class LeadSubfunnelChecklistValueSerializer(serializers.ModelSerializer):
    template_item_title = serializers.CharField(source="template_item.title", read_only=True)
    template_item_order = serializers.IntegerField(source="template_item.order", read_only=True)
    template_item_stage_id = serializers.IntegerField(source="template_item.stage_id", read_only=True)
    template_item_stage_name = serializers.CharField(source="template_item.stage.name", read_only=True)
    assignee_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeadSubfunnelChecklistValue
        fields = [
            "id",
            "lead_subfunnel",
            "template_item",
            "template_item_title",
            "template_item_order",
            "template_item_stage_id",
            "template_item_stage_name",
            "is_completed",
            "text_value",
            "assignee",
            "assignee_name",
            "completed_at",
            "completed_by",
            "completed_by_name",
        ]
        read_only_fields = ["id", "completed_at", "completed_by"]

    def get_assignee_name(self, obj):
        return str(obj.assignee) if obj.assignee else None

    def get_completed_by_name(self, obj):
        return str(obj.completed_by) if obj.completed_by else None


class LeadSubfunnelSerializer(serializers.ModelSerializer):
    template_id = serializers.IntegerField(source="campaign_subfunnel.template_id", read_only=True)
    template_name = serializers.CharField(source="campaign_subfunnel.template.name", read_only=True)
    role_id = serializers.IntegerField(source="campaign_subfunnel.role_id", read_only=True)
    role_name = serializers.CharField(source="campaign_subfunnel.role.name", read_only=True)
    region_id = serializers.SerializerMethodField()
    region_name = serializers.SerializerMethodField()
    is_region_task = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    assignee_name = serializers.SerializerMethodField()
    current_template_stage_name = serializers.CharField(source="current_template_stage.name", read_only=True)
    current_template_stage_order = serializers.IntegerField(source="current_template_stage.order", read_only=True)
    can_advance_stage = serializers.SerializerMethodField()
    can_retreat_stage = serializers.SerializerMethodField()
    checklist_values = LeadSubfunnelChecklistValueSerializer(many=True, read_only=True)
    forwarded_from = serializers.SerializerMethodField()

    class Meta:
        model = LeadSubfunnel
        fields = [
            "id",
            "lead",
            "campaign_subfunnel",
            "campaign_region",
            "campaign_region_id",
            "region_id",
            "region_name",
            "is_region_task",
            "display_name",
            "template_id",
            "template_name",
            "role_id",
            "role_name",
            "status",
            "current_template_stage",
            "current_template_stage_name",
            "current_template_stage_order",
            "can_advance_stage",
            "can_retreat_stage",
            "assignee",
            "assignee_name",
            "started_at",
            "due_at",
            "completed_at",
            "is_available",
            "forwarded_from",
            "checklist_values",
        ]

    def get_assignee_name(self, obj):
        return str(obj.assignee) if obj.assignee else None

    def get_region_id(self, obj):
        if obj.campaign_region_id and obj.campaign_region:
            return obj.campaign_region.region_id
        return None

    def get_region_name(self, obj):
        if obj.campaign_region_id and obj.campaign_region:
            return obj.campaign_region.region.name
        return None

    def get_is_region_task(self, obj):
        return bool(obj.campaign_region_id)

    def get_display_name(self, obj):
        if obj.campaign_region_id and obj.campaign_region:
            return f"Регион: {obj.campaign_region.region.name}"
        if obj.lead and obj.lead.organization:
            return obj.lead.organization.name
        return None

    def get_forwarded_from(self, obj):
        if not obj.lead:
            return None
        return extract_forwarded_from_notes(obj.lead.notes)

    def _ordered_stage_ids(self, obj):
        return list(
            TaskTemplateStage.objects.filter(template_id=obj.campaign_subfunnel.template_id)
            .order_by("order", "id")
            .values_list("id", flat=True)
        )

    def get_can_advance_stage(self, obj):
        if not obj.current_template_stage_id:
            return False
        stage_ids = self._ordered_stage_ids(obj)
        if not stage_ids:
            return False
        idx = stage_ids.index(obj.current_template_stage_id) if obj.current_template_stage_id in stage_ids else -1
        return idx >= 0 and idx < len(stage_ids) - 1

    def get_can_retreat_stage(self, obj):
        if not obj.current_template_stage_id:
            return False
        stage_ids = self._ordered_stage_ids(obj)
        if not stage_ids:
            return False
        idx = stage_ids.index(obj.current_template_stage_id) if obj.current_template_stage_id in stage_ids else -1
        return idx > 0


class CampaignSubfunnelSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="template.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    default_assignee_name = serializers.SerializerMethodField()
    lead_subfunnels_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CampaignSubfunnel
        fields = [
            "id",
            "campaign",
            "funnel",
            "template",
            "template_name",
            "binding",
            "role",
            "role_name",
            "default_assignee",
            "default_assignee_name",
            "template_version",
            "is_active",
            "lead_subfunnels_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "template_version"]

    def get_default_assignee_name(self, obj):
        return str(obj.default_assignee) if obj.default_assignee else None


# Campaign serializers


def _demand_summary_zeros():
    return {
        "plan": 0,
        "declared_collected": 0,
        "declared_quota": 0,
        "list_collected": 0,
        "list_quota": 0,
    }


def campaign_demand_summary_dict(obj):
    """Сводка по лидам: план и собрано/квоты заявл. и списочн."""
    if hasattr(obj, "_d_plan"):
        try:
            return {
                "plan": int(obj._d_plan or 0),
                "declared_collected": int(obj._d_cd or 0),
                "declared_quota": int(obj._d_qd or 0),
                "list_collected": int(obj._d_cl or 0),
                "list_quota": int(obj._d_ql or 0),
            }
        except (TypeError, ValueError):
            pass
    try:
        a = obj.leads.aggregate(
            p=Sum("forecast_demand"),
            cd=Sum("demand_collected_declared"),
            cl=Sum("demand_collected_list"),
            qd=Sum("demand_quota_declared"),
            ql=Sum("demand_quota_list"),
        )
    except (OperationalError, ProgrammingError):
        try:
            a = obj.leads.aggregate(p=Sum("forecast_demand"))
            p = a.get("p")
            return {
                "plan": int(p or 0),
                "declared_collected": 0,
                "declared_quota": 0,
                "list_collected": 0,
                "list_quota": 0,
            }
        except (OperationalError, ProgrammingError):
            return _demand_summary_zeros()

    def nz(v):
        return int(v or 0)

    return {
        "plan": nz(a["p"]),
        "declared_collected": nz(a["cd"]),
        "declared_quota": nz(a["qd"]),
        "list_collected": nz(a["cl"]),
        "list_quota": nz(a["ql"]),
    }


class CampaignListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    operational_stage_display = serializers.CharField(
        source="get_operational_stage_display", read_only=True
    )
    federal_operator_name = serializers.CharField(
        source="federal_operator.name", read_only=True, default=None
    )
    federal_operator_short_name = serializers.SerializerMethodField()
    federal_operators = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    federal_operator_names = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True, default=None)
    acting_organization_name = serializers.CharField(
        source="acting_organization.name", read_only=True, default=None
    )
    created_by_name = serializers.SerializerMethodField()
    total_demand = serializers.IntegerField(read_only=True)
    organizations_count = serializers.IntegerField(read_only=True)
    leads_count = serializers.IntegerField(read_only=True)
    programs_count = serializers.SerializerMethodField()
    regions_count = serializers.SerializerMethodField()
    funnel_names = serializers.SerializerMethodField()
    queue_period_start = serializers.SerializerMethodField()
    queue_period_end = serializers.SerializerMethodField()
    queue_periods = serializers.SerializerMethodField()
    demand_summary = serializers.SerializerMethodField()
    tags = serializers.PrimaryKeyRelatedField(
        many=True, queryset=OrganizationTag.objects.all(), required=False,
    )
    tag_names = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "status", "status_display",
            "operational_stage", "operational_stage_display",
            "federal_operator", "federal_operator_name",
            "federal_operator_short_name",
            "federal_operators", "federal_operator_names",
            "project", "project_name", "acting_organization", "acting_organization_name",
            "collect_search_task",
            "created_by", "created_by_name",
            "total_demand", "organizations_count", "leads_count",
            "programs_count", "regions_count", "funnel_names",
            "queue_period_start", "queue_period_end", "queue_periods",
            "demand_summary",
            "tags", "tag_names",
            "created_at", "updated_at",
        ]

    def get_tag_names(self, obj):
        return list(obj.tags.order_by("name").values_list("name", flat=True))

    def get_federal_operator_short_name(self, obj):
        fo = obj.federal_operator
        if not fo:
            return None
        s = (fo.short_name or "").strip()
        return s or None

    def get_federal_operator_names(self, obj):
        return list(obj.federal_operators.values_list("name", flat=True))

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None

    @staticmethod
    def _add_business_days(start, days):
        from datetime import timedelta
        if not start or not days:
            return None
        current = start
        remaining = days
        while remaining > 0:
            current += timedelta(days=1)
            if current.weekday() < 5:
                remaining -= 1
        return current

    def get_queue_periods(self, obj):
        result = []
        for q in obj.queues.prefetch_related("stage_deadlines").order_by("queue_number"):
            if not q.start_date:
                continue
            total_days = sum(sd.deadline_days for sd in q.stage_deadlines.all())
            end_date = self._add_business_days(q.start_date, total_days)
            result.append({
                "name": q.name or f"Очередь {q.queue_number}",
                "queue_number": q.queue_number,
                "start_date": q.start_date.isoformat(),
                "end_date": end_date.isoformat() if end_date else None,
            })
        return result

    def get_queue_period_start(self, obj):
        dates = [q.start_date for q in obj.queues.all() if q.start_date]
        return min(dates).isoformat() if dates else None

    def get_queue_period_end(self, obj):
        # compute from stage deadlines, not manually set end_date
        ends = []
        for q in obj.queues.prefetch_related("stage_deadlines").all():
            if not q.start_date:
                continue
            total_days = sum(sd.deadline_days for sd in q.stage_deadlines.all())
            end = self._add_business_days(q.start_date, total_days)
            if end:
                ends.append(end)
        return max(ends).isoformat() if ends else None

    def get_programs_count(self, obj):
        return obj.campaign_programs.count()

    def get_regions_count(self, obj):
        return (
            obj.leads
            .annotate(_region=Coalesce("region_id", "organization__region_id"))
            .exclude(_region__isnull=True)
            .values("_region")
            .distinct()
            .count()
        )

    def get_funnel_names(self, obj):
        return list(obj.funnels.values_list("name", flat=True))

    def get_demand_summary(self, obj):
        return campaign_demand_summary_dict(obj)


class CampaignDetailSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    operational_stage_display = serializers.CharField(
        source="get_operational_stage_display", read_only=True
    )
    federal_operator_name = serializers.CharField(
        source="federal_operator.name", read_only=True, default=None
    )
    federal_operator_short_name = serializers.SerializerMethodField()
    federal_operators = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    federal_operator_names = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True, default=None)
    acting_organization_name = serializers.CharField(
        source="acting_organization.name", read_only=True, default=None
    )
    created_by_name = serializers.SerializerMethodField()
    queues = CampaignQueueSerializer(many=True, read_only=True)
    campaign_funnels = CampaignFunnelSerializer(many=True, read_only=True)
    campaign_programs = CampaignProgramSerializer(many=True, read_only=True)
    campaign_regions = CampaignRegionSerializer(many=True, read_only=True)
    organizations = CampaignOrganizationSerializer(many=True, read_only=True)
    leads = LeadListSerializer(many=True, read_only=True)
    subfunnels = CampaignSubfunnelSerializer(many=True, read_only=True)
    total_demand = serializers.IntegerField(read_only=True)
    organizations_count = serializers.IntegerField(read_only=True)
    leads_count = serializers.IntegerField(read_only=True)
    demand_summary = serializers.SerializerMethodField()
    tags = serializers.PrimaryKeyRelatedField(
        many=True, queryset=OrganizationTag.objects.all(), required=False,
    )
    tag_names = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "status", "status_display",
            "operational_stage", "operational_stage_display",
            "federal_operator", "federal_operator_name",
            "federal_operator_short_name",
            "federal_operators", "federal_operator_names",
            "project", "project_name", "acting_organization", "acting_organization_name",
            "collect_search_task",
            "hypothesis", "hypothesis_result",
            "created_by", "created_by_name",
            "queues", "campaign_funnels",
            "campaign_programs", "campaign_regions",
            "organizations", "leads", "subfunnels",
            "total_demand", "organizations_count", "leads_count",
            "demand_summary",
            "tags", "tag_names",
            "created_at", "updated_at",
        ]

    def get_tag_names(self, obj):
        return list(obj.tags.order_by("name").values_list("name", flat=True))

    def get_federal_operator_short_name(self, obj):
        fo = obj.federal_operator
        if not fo:
            return None
        s = (fo.short_name or "").strip()
        return s or None

    def get_federal_operator_names(self, obj):
        return list(obj.federal_operators.values_list("name", flat=True))

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None

    def get_demand_summary(self, obj):
        return campaign_demand_summary_dict(obj)


class QueueStageDeadlineWriteSerializer(serializers.Serializer):
    funnel_stage_id = serializers.IntegerField()
    deadline_days = serializers.IntegerField()


class QueueWriteSerializer(serializers.Serializer):
    queue_number = serializers.IntegerField()
    name = serializers.CharField(max_length=200, required=False, default="")
    start_date = serializers.DateField(required=False, allow_null=True, default=None)
    end_date = serializers.DateField(required=False, allow_null=True, default=None)
    stage_deadlines = QueueStageDeadlineWriteSerializer(many=True, required=False, default=[])


class CampaignCreateSerializer(serializers.ModelSerializer):
    queues = QueueWriteSerializer(many=True, required=False)
    funnel_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    program_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    region_data = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )
    organization_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    lead_data = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )
    manager_assignments = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )
    campaign_subfunnel_data = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )
    federal_operator_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    # Явная цель с фронта — делим на бэкенде; иначе старый баг (полная цель в каждом лиде).
    forecast_demand_mode = serializers.ChoiceField(
        choices=["total", "per_queue", "per_org"],
        required=False,
        allow_null=True,
        write_only=True,
    )
    forecast_total_goal = serializers.IntegerField(
        required=False, allow_null=True, write_only=True
    )
    forecast_queue_goals = serializers.DictField(
        child=serializers.IntegerField(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "status", "federal_operator", "project", "acting_organization",
            "collect_search_task",
            "hypothesis", "hypothesis_result",
            "tags",
            "federal_operator_ids",
            "queues", "funnel_ids", "program_ids", "region_data",
            "organization_ids", "lead_data", "manager_assignments",
            "campaign_subfunnel_data",
            "forecast_demand_mode", "forecast_total_goal", "forecast_queue_goals",
        ]
        read_only_fields = ["id"]

    @staticmethod
    def _split_forecast_across_leads(lead_data, mode, total_goal, queue_goals):
        """Записывает в каждый элемент lead_data долю forecast_demand по выбранному режиму."""
        if not lead_data:
            return
        if not mode or mode == "per_org":
            return
        if mode == "total" and total_goal is not None:
            n = len(lead_data)
            if n == 0:
                return
            share = round(total_goal / n)
            for ld in lead_data:
                ld["forecast_demand"] = share
            return
        if mode == "per_queue" and queue_goals:
            from collections import defaultdict

            by_q = defaultdict(list)
            for ld in lead_data:
                qn = ld.get("queue_number", 1)
                by_q[qn].append(ld)
            for qn, group in by_q.items():
                goal = queue_goals.get(qn)
                if goal is None:
                    goal = queue_goals.get(str(qn))
                if goal is None and isinstance(qn, (int, float)):
                    goal = queue_goals.get(int(qn))
                if goal is None:
                    continue
                m = len(group)
                if m == 0:
                    continue
                sh = round(goal / m)
                for ld in group:
                    ld["forecast_demand"] = sh

    def create(self, validated_data):
        queues_data = validated_data.pop("queues", [])
        funnel_ids = validated_data.pop("funnel_ids", [])
        program_ids = validated_data.pop("program_ids", [])
        region_data = validated_data.pop("region_data", [])
        organization_ids = validated_data.pop("organization_ids", [])
        tag_ids = validated_data.pop("tags", [])
        forecast_demand_mode = validated_data.pop("forecast_demand_mode", None)
        forecast_total_goal = validated_data.pop("forecast_total_goal", None)
        forecast_queue_goals = validated_data.pop("forecast_queue_goals", None)
        lead_data = validated_data.pop("lead_data", [])
        manager_assignments = validated_data.pop("manager_assignments", [])
        campaign_subfunnel_data = validated_data.pop("campaign_subfunnel_data", [])
        federal_operator_ids = validated_data.pop("federal_operator_ids", None)
        self._split_forecast_across_leads(
            lead_data,
            forecast_demand_mode,
            forecast_total_goal,
            forecast_queue_goals or {},
        )

        validated_data["created_by"] = self.context["request"].user
        campaign = Campaign.objects.create(**validated_data)
        if federal_operator_ids is None:
            if campaign.federal_operator_id:
                federal_operator_ids = [campaign.federal_operator_id]
            else:
                federal_operator_ids = []
        if federal_operator_ids:
            campaign.federal_operators.set(federal_operator_ids)
            if not campaign.federal_operator_id:
                campaign.federal_operator_id = federal_operator_ids[0]
                campaign.save(update_fields=["federal_operator"])
        else:
            campaign.federal_operators.clear()
            if campaign.federal_operator_id is not None:
                campaign.federal_operator_id = None
                campaign.save(update_fields=["federal_operator"])
        if tag_ids:
            campaign.tags.set(tag_ids)

        for fid in funnel_ids:
            CampaignFunnel.objects.create(campaign=campaign, funnel_id=fid)

        queue_map = {}
        for q_data in queues_data:
            stage_deadlines = q_data.pop("stage_deadlines", [])
            q_data.pop("campaign", None)
            queue = CampaignQueue.objects.create(campaign=campaign, **q_data)
            queue_map[queue.queue_number] = queue
            for sd in stage_deadlines:
                QueueStageDeadline.objects.create(
                    queue=queue,
                    funnel_stage_id=sd["funnel_stage_id"],
                    deadline_days=sd["deadline_days"],
                )

        for pid in program_ids:
            CampaignProgram.objects.create(campaign=campaign, program_id=pid)

        for rd in region_data:
            queue_number = rd.get("queue_number")
            queue = queue_map.get(queue_number) if queue_number else None
            CampaignRegion.objects.create(
                campaign=campaign,
                region_id=rd["region_id"],
                queue=queue,
                manager_id=rd.get("manager_id"),
                primary_contact_specialist_id=rd.get("specialist_id"),
                demand_quota=rd.get("demand_quota") or 0,
                search_task=rd.get("search_task") or "",
            )

        for oid in organization_ids:
            CampaignOrganization.objects.create(
                campaign=campaign, organization_id=oid
            )

        first_queue = queue_map.get(1)
        for ld in lead_data:
            q_num = ld.get("queue_number", 1)
            queue = queue_map.get(q_num, first_queue)
            funnel_id = ld.get("funnel_id")
            org_id = ld.get("organization_id")
            if not org_id or not funnel_id:
                continue
            region_id = ld.get("region_id")
            if region_id is None and org_id:
                from apps.organizations.models import Organization as OrgModel
                region_id = (
                    OrgModel.objects.filter(id=org_id)
                    .values_list("region_id", flat=True)
                    .first()
                )
            Lead.objects.create(
                campaign=campaign,
                organization_id=org_id,
                funnel_id=funnel_id,
                region_id=region_id,
                queue=queue,
                manager_id=ld.get("manager_id"),
                primary_contact_specialist_id=ld.get("specialist_id"),
                forecast_demand=ld.get("forecast_demand"),
            )

        for assignment in manager_assignments:
            level = assignment.get("level")
            target_id = assignment.get("target_id")
            manager_id = assignment.get("manager_id")
            if level == "program":
                CampaignProgram.objects.filter(
                    campaign=campaign, program_id=target_id
                ).update(manager_id=manager_id)
            elif level == "region":
                CampaignRegion.objects.filter(
                    campaign=campaign, region_id=target_id
                ).update(manager_id=manager_id)
            elif level == "organization":
                CampaignOrganization.objects.filter(
                    campaign=campaign, organization_id=target_id
                ).update(manager_id=manager_id)
            elif level == "lead":
                Lead.objects.filter(
                    campaign=campaign, id=target_id
                ).update(manager_id=manager_id)
            elif level == "region_specialist":
                CampaignRegion.objects.filter(
                    campaign=campaign, region_id=target_id
                ).update(primary_contact_specialist_id=manager_id)
            elif level == "lead_specialist":
                Lead.objects.filter(
                    campaign=campaign, id=target_id
                ).update(primary_contact_specialist_id=manager_id)

        if not campaign_subfunnel_data:
            campaign_subfunnel_data = self._build_default_campaign_subfunnels(funnel_ids)
        self._upsert_campaign_subfunnels(campaign, campaign_subfunnel_data)
        from .collect_tasks import activate_collect_campaign_workflow, deactivate_collect_campaign_workflow
        if campaign.status == Campaign.Status.ACTIVE:
            activate_collect_campaign_workflow(campaign)
        else:
            deactivate_collect_campaign_workflow(campaign)
        return campaign

    def update(self, instance, validated_data):
        queues_data = validated_data.pop("queues", None)
        funnel_ids = validated_data.pop("funnel_ids", None)
        program_ids = validated_data.pop("program_ids", None)
        region_data = validated_data.pop("region_data", None)
        organization_ids = validated_data.pop("organization_ids", None)
        lead_data = validated_data.pop("lead_data", None)
        manager_assignments = validated_data.pop("manager_assignments", None)
        campaign_subfunnel_data = validated_data.pop("campaign_subfunnel_data", None)
        federal_operator_ids = validated_data.pop("federal_operator_ids", None)
        forecast_demand_mode = validated_data.pop("forecast_demand_mode", None)
        forecast_total_goal = validated_data.pop("forecast_total_goal", None)
        forecast_queue_goals = validated_data.pop("forecast_queue_goals", None)

        old_status = instance.status
        instance = super().update(instance, validated_data)
        if federal_operator_ids is not None:
            instance.federal_operators.set(federal_operator_ids)
            new_primary = federal_operator_ids[0] if federal_operator_ids else None
            if instance.federal_operator_id != new_primary:
                instance.federal_operator_id = new_primary
                instance.save(update_fields=["federal_operator"])
        elif instance.federal_operator_id:
            # keep m2m in sync for legacy writes using single federal_operator
            instance.federal_operators.set([instance.federal_operator_id])

        if funnel_ids is not None:
            instance.campaign_funnels.all().delete()
            for fid in funnel_ids:
                CampaignFunnel.objects.create(campaign=instance, funnel_id=fid)

        if program_ids is not None:
            instance.campaign_programs.all().delete()
            for pid in program_ids:
                CampaignProgram.objects.create(campaign=instance, program_id=pid)

        if region_data is not None:
            instance.campaign_regions.all().delete()
            queue_map_for_regions = {q.queue_number: q for q in instance.queues.order_by("queue_number")}
            for rd in region_data:
                queue_number = rd.get("queue_number")
                queue = queue_map_for_regions.get(queue_number) if queue_number else None
                CampaignRegion.objects.create(
                    campaign=instance,
                    region_id=rd["region_id"],
                    queue=queue,
                    manager_id=rd.get("manager_id"),
                    primary_contact_specialist_id=rd.get("specialist_id"),
                    demand_quota=rd.get("demand_quota") or 0,
                    search_task=rd.get("search_task") or "",
                )

        if organization_ids is not None:
            instance.organizations.all().delete()
            for oid in organization_ids:
                CampaignOrganization.objects.create(campaign=instance, organization_id=oid)

        if queues_data is not None:
            instance.queues.all().delete()
            queue_map = {}
            for q_data in queues_data:
                stage_deadlines = q_data.pop("stage_deadlines", [])
                q_data.pop("campaign", None)
                queue = CampaignQueue.objects.create(campaign=instance, **q_data)
                queue_map[queue.queue_number] = queue
                for sd in stage_deadlines:
                    QueueStageDeadline.objects.create(
                        queue=queue,
                        funnel_stage_id=sd["funnel_stage_id"],
                        deadline_days=sd["deadline_days"],
                    )

        if lead_data is not None:
            from apps.organizations.models import Organization as OrgModel
            self._split_forecast_across_leads(
                lead_data,
                forecast_demand_mode,
                forecast_total_goal,
                forecast_queue_goals or {},
            )
            queue_map = {q.queue_number: q for q in instance.queues.order_by("queue_number")}
            first_queue = instance.queues.order_by("queue_number").first()

            default_funnel = instance.campaign_funnels.order_by("id").first()
            default_funnel_id = default_funnel.funnel_id if default_funnel else None

            resolved = []
            for ld in lead_data:
                q_num = ld.get("queue_number", 1)
                queue = queue_map.get(q_num, first_queue)
                funnel_id = ld.get("funnel_id") or default_funnel_id

                if not funnel_id:
                    continue

                org_id = ld.get("organization_id")
                if not org_id:
                    org_name = ld.get("organization_name", "")
                    org = OrgModel.objects.filter(name=org_name).first() \
                        or OrgModel.objects.filter(short_name=org_name).first()
                    if org:
                        org_id = org.id
                    else:
                        # Temporary generated INN for imported organizations without explicit INN.
                        generated_inn = str(random.randint(10**11, 10**12 - 1))
                        while OrgModel.objects.filter(inn=generated_inn).exists():
                            generated_inn = str(random.randint(10**11, 10**12 - 1))
                        org = OrgModel.objects.create(
                            name=org_name,
                            short_name=org_name[:200],
                            inn=generated_inn,
                        )
                        org_id = org.id

                if not org_id:
                    continue

                region_id = ld.get("region_id")
                if region_id is None:
                    region_id = (
                        OrgModel.objects.filter(id=org_id)
                        .values_list("region_id", flat=True)
                        .first()
                    )

                resolved.append({
                    "organization_id": org_id,
                    "funnel_id": funnel_id,
                    "region_id": region_id,
                    "queue": queue,
                    "manager_id": ld.get("manager_id"),
                    "specialist_id": ld.get("specialist_id"),
                    "forecast_demand": ld.get("forecast_demand"),
                })

            incoming_keys = {
                (r["organization_id"], r["funnel_id"], r["region_id"])
                for r in resolved
            }

            for lead in list(instance.leads.all()):
                if (lead.organization_id, lead.funnel_id, lead.region_id) not in incoming_keys:
                    lead.delete()

            for r in resolved:
                Lead.objects.update_or_create(
                    campaign=instance,
                    organization_id=r["organization_id"],
                    funnel_id=r["funnel_id"],
                    region_id=r["region_id"],
                    defaults={
                        "queue": r["queue"],
                        "manager_id": r["manager_id"],
                        "primary_contact_specialist_id": r["specialist_id"],
                        "forecast_demand": r["forecast_demand"],
                    },
                )

            if instance.status == "active":
                self._activate_leads(instance)

        if manager_assignments is not None:
            for assignment in manager_assignments:
                level = assignment.get("level")
                target_id = assignment.get("target_id")
                manager_id = assignment.get("manager_id")
                if level == "program":
                    CampaignProgram.objects.filter(
                        campaign=instance, program_id=target_id
                    ).update(manager_id=manager_id)
                elif level == "lead":
                    Lead.objects.filter(
                        campaign=instance, id=target_id
                    ).update(manager_id=manager_id)
                elif level == "region_specialist":
                    CampaignRegion.objects.filter(
                        campaign=instance, region_id=target_id
                    ).update(primary_contact_specialist_id=manager_id)
                elif level == "lead_specialist":
                    Lead.objects.filter(
                        campaign=instance, id=target_id
                    ).update(primary_contact_specialist_id=manager_id)

        if campaign_subfunnel_data is not None:
            self._upsert_campaign_subfunnels(instance, campaign_subfunnel_data)

        from .collect_tasks import activate_collect_campaign_workflow, deactivate_collect_campaign_workflow
        if instance.status == Campaign.Status.ACTIVE:
            activate_collect_campaign_workflow(instance)
        else:
            deactivate_collect_campaign_workflow(instance)

        if old_status != "active" and instance.status == "active":
            self._activate_leads(instance)

        return instance

    @staticmethod
    def _upsert_campaign_subfunnels(campaign, rows):
        if rows is None:
            return
        if not rows:
            campaign.subfunnels.all().delete()
            return
        keep_ids = []
        for row in rows:
            template_id = row.get("template_id") or row.get("template")
            funnel_id = row.get("funnel_id") or row.get("funnel")
            if not template_id or not funnel_id:
                continue
            defaults = {
                "binding_id": row.get("binding_id") or row.get("binding"),
                "role_id": row.get("role_id") or row.get("role"),
                "default_assignee_id": row.get("default_assignee_id") or row.get("default_assignee"),
                "is_active": row.get("is_active", True),
            }
            obj, _ = CampaignSubfunnel.objects.update_or_create(
                campaign=campaign,
                template_id=template_id,
                binding_id=defaults["binding_id"],
                defaults={
                    "funnel_id": funnel_id,
                    "role_id": defaults["role_id"],
                    "default_assignee_id": defaults["default_assignee_id"],
                    "is_active": defaults["is_active"],
                },
            )
            keep_ids.append(obj.id)
        if keep_ids:
            campaign.subfunnels.exclude(id__in=keep_ids).delete()

    @staticmethod
    def _build_default_campaign_subfunnels(funnel_ids):
        if not funnel_ids:
            return []
        from apps.funnels.models import SubfunnelTemplateBinding
        rows = []
        bindings = SubfunnelTemplateBinding.objects.filter(
            funnel_id__in=funnel_ids,
            is_active=True,
            template__is_active=True,
        ).select_related("template")
        for binding in bindings:
            rows.append(
                {
                    "funnel_id": binding.funnel_id,
                    "template_id": binding.template_id,
                    "binding_id": binding.id,
                    "role_id": binding.role_id or binding.template.owner_role_id,
                    "default_assignee_id": binding.default_specialist_id,
                    "is_active": True,
                }
            )
        return rows

    @staticmethod
    def _activate_leads(campaign):
        """Set first non-rejection stage + create checklist values for all leads."""
        from .collect_tasks import get_entry_funnel_stage_for_lead

        for lead in campaign.leads.filter(current_stage__isnull=True).select_related("funnel"):
            first_stage = get_entry_funnel_stage_for_lead(lead.funnel)
            if first_stage:
                lead.current_stage = first_stage
                if first_stage.primary_contact_specialist_id and not lead.primary_contact_specialist_id:
                    lead.primary_contact_specialist_id = first_stage.primary_contact_specialist_id
                lead.save(
                    update_fields=[
                        "current_stage",
                        "primary_contact_specialist",
                        "updated_at",
                    ]
                )
                for item in first_stage.checklist_items.all():
                    LeadChecklistValue.objects.get_or_create(
                        lead=lead,
                        checklist_item=item,
                        defaults={
                            "primary_contact_specialist_id": (
                                item.primary_contact_specialist_id
                                or lead.primary_contact_specialist_id
                            )
                        },
                    )
            CampaignCreateSerializer._materialize_lead_subfunnels(lead)

    @staticmethod
    def _materialize_lead_subfunnels(lead, source: str = ""):
        subfunnels = lead.campaign.subfunnels.filter(is_active=True)
        if source == "collect_import":
            subfunnels = subfunnels.filter(template__auto_create_on_collect_import=True)
        subfunnels = subfunnels.select_related(
            "template",
            "binding",
            "default_assignee",
        ).prefetch_related("template__items")
        for sub in subfunnels:
            stages = list(CampaignCreateSerializer._ensure_default_template_stages(sub.template))
            default_stage = stages[0] if stages else None
            defaults = {
                "assignee_id": sub.default_assignee_id,
                "current_template_stage_id": default_stage.id if default_stage else None,
                "status": LeadSubfunnel.Status.BACKLOG,
                "is_available": True,
            }
            if sub.binding and sub.binding.binding_type == "stage_range_checklist":
                defaults["is_available"] = bool(
                    lead.current_stage_id
                    and sub.binding.from_stage_id
                    and sub.binding.to_stage_id
                    and sub.binding.from_stage.order <= lead.current_stage.order <= sub.binding.to_stage.order
                )
            lead_sub, _ = LeadSubfunnel.objects.get_or_create(
                campaign_subfunnel=sub,
                lead=lead,
                defaults=defaults,
            )
            if not lead_sub.current_template_stage_id and default_stage:
                lead_sub.current_template_stage_id = default_stage.id
                lead_sub.status = LeadSubfunnel.normalize_status(lead_sub.status)
                lead_sub.save(update_fields=["current_template_stage", "status", "updated_at"])
            for item in sub.template.items.all():
                LeadSubfunnelChecklistValue.objects.get_or_create(
                    lead_subfunnel=lead_sub,
                    template_item=item,
                    defaults={"assignee_id": item.default_specialist_id or lead_sub.assignee_id},
                )

    @staticmethod
    def _ensure_default_template_stages(template):
        qs = template.stages.order_by("order", "id")
        if qs.exists():
            return qs
        TaskTemplateStage.objects.bulk_create(
            [
                TaskTemplateStage(template=template, name="К выполнению", order=0, is_terminal=False),
                TaskTemplateStage(template=template, name="В работе", order=1, is_terminal=False),
                TaskTemplateStage(template=template, name="Готово", order=2, is_terminal=True),
            ]
        )
        return template.stages.order_by("order", "id")

    @staticmethod
    def _stage_for_legacy_status(stages, legacy_status):
        if not stages:
            return None
        if legacy_status == LeadSubfunnel.Status.DONE:
            return next((s for s in reversed(stages) if s.is_terminal), stages[-1])
        if legacy_status == LeadSubfunnel.Status.IN_PROGRESS:
            return stages[1] if len(stages) > 1 else stages[0]
        return stages[0]

from rest_framework import serializers
from .models import (
    Campaign, CampaignQueue, CampaignProgram,
    CampaignRegion, CampaignOrganization,
    CampaignFunnel, QueueStageDeadline,
    Lead, LeadChecklistValue, LeadInteraction,
)
from apps.accounts.serializers import UserShortSerializer


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

    class Meta:
        model = CampaignRegion
        fields = [
            "id", "campaign", "region", "region_name",
            "federal_district_name", "queue", "queue_name",
            "manager", "manager_name",
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

    class Meta:
        model = CampaignOrganization
        fields = [
            "id", "campaign", "organization", "organization_name",
            "organization_region", "organization_type",
            "status", "status_display", "manager", "manager_name",
            "demand_count", "notes",
        ]
        read_only_fields = ["id"]

    def get_manager_name(self, obj):
        if obj.manager:
            return str(obj.manager)
        return None


# Lead serializers

class LeadChecklistValueSerializer(serializers.ModelSerializer):
    checklist_item_text = serializers.CharField(
        source="checklist_item.text", read_only=True
    )
    confirmation_type = serializers.CharField(
        source="checklist_item.confirmation_type", read_only=True
    )
    stage_id = serializers.IntegerField(
        source="checklist_item.stage_id", read_only=True
    )
    options = serializers.SerializerMethodField()
    contact_full_name = serializers.CharField(
        source="contact.full_name", read_only=True, default=None
    )

    class Meta:
        model = LeadChecklistValue
        fields = [
            "id", "lead", "checklist_item", "checklist_item_text",
            "confirmation_type", "stage_id", "options", "is_completed",
            "text_value", "file_value", "select_value",
            "contact", "contact_full_name",
            "contact_name", "contact_position", "contact_phone",
            "contact_email", "contact_messenger",
            "completed_at", "completed_by",
        ]
        read_only_fields = ["id", "completed_at", "completed_by"]

    def get_options(self, obj):
        if obj.checklist_item.confirmation_type != "select":
            return []
        return list(
            obj.checklist_item.options.order_by("order").values_list("value", flat=True)
        )


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


class LeadListSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(
        source="organization.name", read_only=True
    )
    organization_region = serializers.CharField(
        source="organization.region.name", read_only=True, default=None
    )
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
    checklist_progress = serializers.SerializerMethodField()
    checklist_summary = serializers.SerializerMethodField()
    last_interaction = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            "id", "campaign", "organization", "organization_name",
            "organization_region", "funnel", "funnel_name",
            "queue", "queue_name",
            "current_stage", "current_stage_name", "current_stage_is_rejection",
            "manager", "manager_name",
            "forecast_demand", "demand_count", "notes",
            "checklist_progress", "checklist_summary", "last_interaction",
            "created_at", "updated_at",
        ]

    def get_queue_name(self, obj):
        if obj.queue:
            return str(obj.queue)
        return None

    def get_manager_name(self, obj):
        if obj.manager:
            return str(obj.manager)
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


class LeadDetailSerializer(LeadListSerializer):
    checklist_values = LeadChecklistValueSerializer(many=True, read_only=True)
    interactions = LeadInteractionSerializer(many=True, read_only=True)
    stage_deadlines = serializers.SerializerMethodField()

    class Meta(LeadListSerializer.Meta):
        fields = LeadListSerializer.Meta.fields + [
            "checklist_values", "interactions", "stage_deadlines",
        ]

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
            })
        return result


# Campaign serializers

class CampaignListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    federal_operator_name = serializers.CharField(
        source="federal_operator.display_name", read_only=True, default=None
    )
    created_by_name = serializers.SerializerMethodField()
    total_demand = serializers.IntegerField(read_only=True)
    organizations_count = serializers.IntegerField(read_only=True)
    leads_count = serializers.IntegerField(read_only=True)
    programs_count = serializers.SerializerMethodField()
    regions_count = serializers.SerializerMethodField()
    funnel_names = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "status", "status_display",
            "federal_operator", "federal_operator_name",
            "created_by", "created_by_name",
            "total_demand", "organizations_count", "leads_count",
            "programs_count", "regions_count", "funnel_names",
            "created_at", "updated_at",
        ]

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None

    def get_programs_count(self, obj):
        return obj.campaign_programs.count()

    def get_regions_count(self, obj):
        return (
            obj.leads
            .exclude(organization__region__isnull=True)
            .values("organization__region")
            .distinct()
            .count()
        )

    def get_funnel_names(self, obj):
        return list(obj.funnels.values_list("name", flat=True))


class CampaignDetailSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    federal_operator_name = serializers.CharField(
        source="federal_operator.display_name", read_only=True, default=None
    )
    created_by_name = serializers.SerializerMethodField()
    queues = CampaignQueueSerializer(many=True, read_only=True)
    campaign_funnels = CampaignFunnelSerializer(many=True, read_only=True)
    campaign_programs = CampaignProgramSerializer(many=True, read_only=True)
    campaign_regions = CampaignRegionSerializer(many=True, read_only=True)
    organizations = CampaignOrganizationSerializer(many=True, read_only=True)
    leads = LeadListSerializer(many=True, read_only=True)
    total_demand = serializers.IntegerField(read_only=True)
    organizations_count = serializers.IntegerField(read_only=True)
    leads_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "status", "status_display",
            "federal_operator", "federal_operator_name",
            "hypothesis", "hypothesis_result",
            "created_by", "created_by_name",
            "queues", "campaign_funnels",
            "campaign_programs", "campaign_regions",
            "organizations", "leads",
            "total_demand", "organizations_count", "leads_count",
            "created_at", "updated_at",
        ]

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None


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

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "status", "federal_operator",
            "hypothesis", "hypothesis_result",
            "queues", "funnel_ids", "program_ids", "region_data",
            "organization_ids", "lead_data", "manager_assignments",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        queues_data = validated_data.pop("queues", [])
        funnel_ids = validated_data.pop("funnel_ids", [])
        program_ids = validated_data.pop("program_ids", [])
        region_data = validated_data.pop("region_data", [])
        organization_ids = validated_data.pop("organization_ids", [])
        lead_data = validated_data.pop("lead_data", [])
        manager_assignments = validated_data.pop("manager_assignments", [])

        validated_data["created_by"] = self.context["request"].user
        campaign = Campaign.objects.create(**validated_data)

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
            Lead.objects.create(
                campaign=campaign,
                organization_id=ld["organization_id"],
                funnel_id=funnel_id,
                queue=queue,
                manager_id=ld.get("manager_id"),
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

        return campaign

    def update(self, instance, validated_data):
        queues_data = validated_data.pop("queues", None)
        funnel_ids = validated_data.pop("funnel_ids", None)
        program_ids = validated_data.pop("program_ids", None)
        validated_data.pop("region_data", None)
        validated_data.pop("organization_ids", None)
        lead_data = validated_data.pop("lead_data", None)
        manager_assignments = validated_data.pop("manager_assignments", None)

        old_status = instance.status
        instance = super().update(instance, validated_data)

        if funnel_ids is not None:
            instance.campaign_funnels.all().delete()
            for fid in funnel_ids:
                CampaignFunnel.objects.create(campaign=instance, funnel_id=fid)

        if program_ids is not None:
            instance.campaign_programs.all().delete()
            for pid in program_ids:
                CampaignProgram.objects.create(campaign=instance, program_id=pid)

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
            # Clear existing leads and recreate
            instance.leads.all().delete()
            queue_map = {q.queue_number: q for q in instance.queues.order_by("queue_number")}
            first_queue = instance.queues.order_by("queue_number").first()

            # Fallback funnel: first funnel associated with this campaign
            default_funnel = instance.campaign_funnels.order_by("id").first()
            default_funnel_id = default_funnel.funnel_id if default_funnel else None

            for ld in lead_data:
                q_num = ld.get("queue_number", 1)
                queue = queue_map.get(q_num, first_queue)
                funnel_id = ld.get("funnel_id") or default_funnel_id

                if not funnel_id:
                    continue  # cannot create lead without funnel

                # Resolve organization: accept either organization_id or organization_name
                org_id = ld.get("organization_id")
                if not org_id:
                    org_name = ld.get("organization_name", "")
                    org = OrgModel.objects.filter(name=org_name).first() \
                        or OrgModel.objects.filter(short_name=org_name).first()
                    if org:
                        org_id = org.id
                    else:
                        org = OrgModel.objects.create(
                            name=org_name,
                            short_name=org_name[:200],
                        )
                        org_id = org.id

                if org_id:
                    Lead.objects.create(
                        campaign=instance,
                        organization_id=org_id,
                        funnel_id=funnel_id,
                        queue=queue,
                        manager_id=ld.get("manager_id"),
                        forecast_demand=ld.get("forecast_demand"),
                    )

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

        if old_status != "active" and instance.status == "active":
            self._activate_leads(instance)

        return instance

    @staticmethod
    def _activate_leads(campaign):
        """Set first non-rejection stage + create checklist values for all leads."""
        from apps.funnels.models import FunnelStage

        for lead in campaign.leads.filter(current_stage__isnull=True).select_related("funnel"):
            first_stage = (
                FunnelStage.objects
                .filter(funnel=lead.funnel, is_rejection=False)
                .order_by("order")
                .first()
            )
            if first_stage:
                lead.current_stage = first_stage
                lead.save(update_fields=["current_stage", "updated_at"])
                for item in first_stage.checklist_items.all():
                    LeadChecklistValue.objects.get_or_create(
                        lead=lead, checklist_item=item,
                    )

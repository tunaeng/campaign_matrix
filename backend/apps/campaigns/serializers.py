from rest_framework import serializers
from .models import (
    Campaign, CampaignQueue, CampaignProgram,
    CampaignRegion, CampaignOrganization,
)
from apps.accounts.serializers import UserShortSerializer


class CampaignQueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignQueue
        fields = [
            "id", "campaign", "queue_number", "name",
            "start_date", "end_date",
        ]
        read_only_fields = ["id"]


class CampaignQueueWriteSerializer(serializers.Serializer):
    """Lightweight serializer for nested queue creation (no campaign FK required)."""
    queue_number = serializers.IntegerField()
    name = serializers.CharField(max_length=200, required=False, default="")
    start_date = serializers.DateField(required=False, allow_null=True, default=None)
    end_date = serializers.DateField(required=False, allow_null=True, default=None)


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


class CampaignListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    federal_operator_name = serializers.CharField(
        source="federal_operator.name", read_only=True, default=None
    )
    created_by_name = serializers.SerializerMethodField()
    total_demand = serializers.IntegerField(read_only=True)
    organizations_count = serializers.IntegerField(read_only=True)
    programs_count = serializers.SerializerMethodField()
    regions_count = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "status", "status_display",
            "federal_operator", "federal_operator_name",
            "forecast_demand", "deadline",
            "created_by", "created_by_name",
            "total_demand", "organizations_count",
            "programs_count", "regions_count",
            "created_at", "updated_at",
        ]

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None

    def get_programs_count(self, obj):
        return obj.campaign_programs.count()

    def get_regions_count(self, obj):
        return obj.campaign_regions.count()


class CampaignDetailSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    federal_operator_name = serializers.CharField(
        source="federal_operator.name", read_only=True, default=None
    )
    created_by_name = serializers.SerializerMethodField()
    queues = CampaignQueueSerializer(many=True, read_only=True)
    campaign_programs = CampaignProgramSerializer(many=True, read_only=True)
    campaign_regions = CampaignRegionSerializer(many=True, read_only=True)
    organizations = CampaignOrganizationSerializer(many=True, read_only=True)
    total_demand = serializers.IntegerField(read_only=True)
    organizations_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "status", "status_display",
            "federal_operator", "federal_operator_name",
            "hypothesis", "hypothesis_result",
            "forecast_demand", "deadline",
            "created_by", "created_by_name",
            "queues", "campaign_programs", "campaign_regions",
            "organizations",
            "total_demand", "organizations_count",
            "created_at", "updated_at",
        ]

    def get_created_by_name(self, obj):
        return str(obj.created_by) if obj.created_by else None


class CampaignCreateSerializer(serializers.ModelSerializer):
    queues = CampaignQueueWriteSerializer(many=True, required=False)
    program_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    region_data = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )
    organization_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    manager_assignments = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "status", "federal_operator",
            "hypothesis", "hypothesis_result",
            "forecast_demand", "deadline",
            "queues", "program_ids", "region_data",
            "organization_ids", "manager_assignments",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        queues_data = validated_data.pop("queues", [])
        program_ids = validated_data.pop("program_ids", [])
        region_data = validated_data.pop("region_data", [])
        organization_ids = validated_data.pop("organization_ids", [])
        manager_assignments = validated_data.pop("manager_assignments", [])

        validated_data["created_by"] = self.context["request"].user
        campaign = Campaign.objects.create(**validated_data)

        queue_map = {}
        for q_data in queues_data:
            q_data.pop("campaign", None)
            queue = CampaignQueue.objects.create(campaign=campaign, **q_data)
            queue_map[queue.queue_number] = queue

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

        return campaign

    def update(self, instance, validated_data):
        validated_data.pop("queues", None)
        validated_data.pop("program_ids", None)
        validated_data.pop("region_data", None)
        validated_data.pop("organization_ids", None)
        validated_data.pop("manager_assignments", None)
        return super().update(instance, validated_data)

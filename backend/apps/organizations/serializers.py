from rest_framework import serializers
from .models import Organization, OrganizationInteraction


class OrganizationInteractionSerializer(serializers.ModelSerializer):
    interaction_type_display = serializers.CharField(
        source="get_interaction_type_display", read_only=True
    )
    user_name = serializers.CharField(source="user.__str__", read_only=True, default=None)

    class Meta:
        model = OrganizationInteraction
        fields = [
            "id", "organization", "date", "interaction_type",
            "interaction_type_display", "notes", "user", "user_name",
            "created_at",
        ]


class OrganizationSerializer(serializers.ModelSerializer):
    org_type_display = serializers.CharField(
        source="get_org_type_display", read_only=True
    )
    region_name = serializers.CharField(
        source="region.name", read_only=True, default=None
    )
    parent_organization_name = serializers.CharField(
        source="parent_organization.name", read_only=True, default=None
    )
    has_interaction_history = serializers.BooleanField(read_only=True)
    last_interaction_date = serializers.SerializerMethodField()
    interactions_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id", "name", "short_name", "inn", "org_type", "org_type_display",
            "region", "region_name", "parent_organization",
            "parent_organization_name", "contact_person", "contact_email",
            "contact_phone", "notes", "has_interaction_history",
            "last_interaction_date", "interactions_count",
            "created_at", "updated_at",
        ]

    def get_last_interaction_date(self, obj):
        last = obj.interactions.first()
        return last.date if last else None

    def get_interactions_count(self, obj):
        return obj.interactions.count()


class OrganizationShortSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(
        source="region.name", read_only=True, default=None
    )
    org_type_display = serializers.CharField(
        source="get_org_type_display", read_only=True
    )
    has_interaction_history = serializers.BooleanField(read_only=True)

    class Meta:
        model = Organization
        fields = [
            "id", "name", "short_name", "org_type", "org_type_display",
            "region", "region_name", "has_interaction_history",
        ]

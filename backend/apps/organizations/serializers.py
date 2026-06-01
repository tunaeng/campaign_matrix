import re
import unicodedata

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_unicode_slug
from django.utils.text import slugify
from rest_framework import serializers

from .models import (
    Organization,
    OrganizationInteraction,
    Contact,
    EntityFieldChange,
    ImportBatch,
    OrganizationTag,
    Project,
    ProjectOrganizationMembership,
    UserActingOrganization,
)

# Тире из внешних текстов (Word, PDF) не проходят validate_unicode_slug — только U+002D.
_TAG_SLUG_DASH_MAP = dict.fromkeys(
    map(
        ord,
        "\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2e3a\u2e3b\ufe58\ufe63\uff0d",
    ),
    ord("-"),
)

# Маркеры копипаста / BIO: провал validate_unicode_slug, хотя буквы «обычные».
_TAG_SLUG_STRIP_CF_RE = re.compile(
    "[\u200b\u200c\u200d\ufeff\u200e\u200f\u061c\u2060"
    "\u2066-\u2069\u202a-\u202e]+",
)


def normalize_organization_tag_slug(value: str) -> str:
    if value is None:
        return ""
    s = unicodedata.normalize("NFKC", str(value).strip())
    s = s.translate(_TAG_SLUG_DASH_MAP)
    s = _TAG_SLUG_STRIP_CF_RE.sub("", s)
    # прочие format-char (соединители блоков Arabic и т.п.)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Cf")
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-{2,}", "-", s)
    s = s.strip("-")
    if not s:
        return ""
    # Убирает остаточные «почти буквы» и приводит к виду slug.
    cleaned = slugify(s, allow_unicode=True)
    return cleaned.strip("-") or ""


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
            "project", "acting_organization",
            "created_at",
        ]


def _normalize_inn_digits(value):
    if value is None:
        return None
    s = re.sub(r"\D", "", str(value).strip())
    if not s:
        return None
    if len(s) in (10, 12):
        return s
    raise serializers.ValidationError("ИНН должен содержать 10 или 12 цифр.")


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
    parent_organization_short_name = serializers.SerializerMethodField()
    has_interaction_history = serializers.BooleanField(read_only=True)
    last_interaction_date = serializers.SerializerMethodField()
    interactions_count = serializers.SerializerMethodField()
    tags = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=OrganizationTag.objects.all(),
        required=False,
    )
    tag_names = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id", "name", "short_name", "inn", "org_type", "org_type_display",
            "region", "region_name", "parent_organization",
            "parent_organization_name", "parent_organization_short_name", "contact_person", "contact_email",
            "contact_phone", "contact_phone_extension", "is_our_side", "description", "tags", "tag_names",
            "notes", "has_interaction_history",
            "last_interaction_date", "interactions_count",
            "created_at", "updated_at",
        ]

    def get_last_interaction_date(self, obj):
        last = obj.interactions.first()
        return last.date if last else None

    def get_interactions_count(self, obj):
        return obj.interactions.count()

    def get_parent_organization_short_name(self, obj):
        p = getattr(obj, "parent_organization", None)
        if not p:
            return None
        s = (p.short_name or "").strip()
        return s or p.name or None

    def get_tag_names(self, obj):
        return list(obj.tags.values_list("name", flat=True))

    def validate(self, attrs):
        org_type = attrs.get("org_type")
        if org_type is None and self.instance is not None:
            org_type = self.instance.org_type

        parent = attrs.get("parent_organization", serializers.empty)
        if parent is serializers.empty:
            parent_obj = (
                getattr(self.instance, "parent_organization", None)
                if self.instance is not None
                else None
            )
        else:
            parent_obj = parent

        parent_id = parent_obj.pk if parent_obj else None

        inn_raw = attrs.get("inn", serializers.empty)
        if inn_raw is serializers.empty:
            inn_existing = getattr(self.instance, "inn", None) if self.instance else None
        else:
            inn_existing = inn_raw

        pk = self.instance.pk if self.instance else None
        if parent_id and pk and parent_id == pk:
            raise serializers.ValidationError(
                {"parent_organization": "Организация не может быть головной сама для себя."}
            )

        if org_type == Organization.OrgType.COMPANY_BRANCH:
            if not parent_id:
                raise serializers.ValidationError(
                    {
                        "parent_organization": "Для подразделения укажите головную организацию (юрлицо)."
                    }
                )
            if not parent_obj.inn or not str(parent_obj.inn).strip():
                raise serializers.ValidationError(
                    {
                        "parent_organization": "У головной организации должен быть указан ИНН."
                    }
                )
            attrs["inn"] = None
        else:
            try:
                digits = _normalize_inn_digits(inn_existing)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"inn": exc.detail}) from exc
            if not digits:
                raise serializers.ValidationError(
                    {
                        "inn": "ИНН обязателен, кроме типа «Подразделение компании (без ИНН)»."
                    }
                )
            attrs["inn"] = digits

        return attrs


class ContactSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(
        source="organization.name", read_only=True
    )
    full_name = serializers.ReadOnlyField()
    type_display = serializers.CharField(
        source="get_type_display", read_only=True
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    tags = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=OrganizationTag.objects.all(),
        required=False,
    )
    tag_names = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = [
            "id", "organization", "organization_name",
            "type", "type_display", "comment", "current",
            "first_name", "last_name", "middle_name",
            "position", "phone", "phone_extension", "email", "messenger",
            "is_manager", "department_name", "full_name",
            "tags", "tag_names",
            "bitrix_contact_id",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "bitrix_contact_id", "created_at", "updated_at"]

    def get_tag_names(self, obj):
        return list(obj.tags.order_by("name").values_list("name", flat=True))


class EntityFieldChangeSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source="changed_by.__str__", read_only=True, default=None)
    organization_name = serializers.CharField(source="organization.name", read_only=True, default=None)
    contact_name = serializers.CharField(source="contact.full_name", read_only=True, default=None)
    source_display = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = EntityFieldChange
        fields = [
            "id",
            "organization",
            "organization_name",
            "contact",
            "contact_name",
            "field_name",
            "old_value",
            "new_value",
            "source",
            "source_display",
            "changed_by",
            "changed_by_name",
            "changed_at",
        ]
        read_only_fields = fields


class ImportBatchSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.__str__", read_only=True, default=None)
    entity_type_display = serializers.CharField(source="get_entity_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    can_rollback = serializers.SerializerMethodField()

    class Meta:
        model = ImportBatch
        fields = [
            "id",
            "entity_type",
            "entity_type_display",
            "file_name",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
            "created_count",
            "updated_count",
            "skipped_count",
            "total_rows",
            "status",
            "status_display",
            "rolled_back_at",
            "can_rollback",
        ]
        read_only_fields = fields

    def get_can_rollback(self, obj):
        return (
            obj.status == ImportBatch.Status.COMPLETED
            and (obj.created_count > 0 or obj.updated_count > 0)
        )


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
            "region", "region_name", "inn", "is_our_side", "has_interaction_history",
        ]


class OrganizationTagSerializer(serializers.ModelSerializer):
    tag_type_display = serializers.CharField(source="get_tag_type_display", read_only=True)
    slug = serializers.CharField(
        max_length=120,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = OrganizationTag
        fields = ["id", "name", "slug", "color", "tag_type", "tag_type_display", "category"]
        extra_kwargs = {
            "color": {"required": False, "allow_blank": True},
            "category": {"required": False, "allow_blank": True},
        }

    def validate_slug(self, value):
        if value is None or not str(value).strip():
            return ""
        normalized = normalize_organization_tag_slug(value)
        if not normalized:
            return ""
        try:
            validate_unicode_slug(normalized)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return normalized


class ProjectOrganizationMembershipSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = ProjectOrganizationMembership
        fields = [
            "id",
            "project",
            "organization",
            "organization_name",
            "role",
            "role_display",
            "notes",
            "sort_order",
            "created_at",
        ]


class ProjectSerializer(serializers.ModelSerializer):
    memberships = ProjectOrganizationMembershipSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "year",
            "code",
            "memberships",
            "created_at",
            "updated_at",
        ]


class UserActingOrganizationSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    organization_inn = serializers.CharField(source="organization.inn", read_only=True)

    class Meta:
        model = UserActingOrganization
        fields = [
            "id",
            "user",
            "organization",
            "organization_name",
            "organization_inn",
            "is_primary",
            "created_at",
        ]

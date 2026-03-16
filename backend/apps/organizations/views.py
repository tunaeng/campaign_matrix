import logging

import requests as http_requests
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Exists, OuterRef
from .models import Organization, OrganizationInteraction, Contact
from .serializers import (
    OrganizationSerializer, OrganizationShortSerializer,
    OrganizationInteractionSerializer, ContactSerializer,
)

logger = logging.getLogger(__name__)


class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer
    filterset_fields = ["org_type", "region", "parent_organization"]
    search_fields = ["name", "short_name", "inn"]

    def get_queryset(self):
        qs = Organization.objects.select_related(
            "region", "parent_organization"
        ).prefetch_related("interactions")

        has_history = self.request.query_params.get("has_history")
        if has_history is not None:
            has_history = has_history.lower() == "true"
            qs = qs.annotate(
                _has_history=Exists(
                    OrganizationInteraction.objects.filter(
                        organization=OuterRef("pk")
                    )
                )
            ).filter(_has_history=has_history)

        region_ids = self.request.query_params.get("region_ids")
        if region_ids:
            ids = [int(x) for x in region_ids.split(",")]
            qs = qs.filter(region_id__in=ids)

        return qs


class OrganizationInteractionViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationInteractionSerializer
    filterset_fields = ["organization", "interaction_type", "user"]

    def get_queryset(self):
        return OrganizationInteraction.objects.select_related(
            "organization", "user"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ContactViewSet(viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    filterset_fields = ["organization", "type", "current", "is_manager"]
    search_fields = ["first_name", "last_name", "middle_name", "position", "department_name"]

    def get_queryset(self):
        qs = Contact.objects.select_related("organization")
        org_name = self.request.query_params.get("organization_name")
        if org_name:
            qs = qs.filter(organization__name__icontains=org_name)
        return qs


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def external_contacts(request):
    """Proxy to Bitrix contacts API with filtering."""
    params = {}
    for key in ("organization", "organization__contains", "type",
                "department", "department__contains", "manager", "current"):
        val = request.query_params.get(key)
        if val:
            params[key] = val
    try:
        data = _bitrix_request("/contacts/api/contacts/", params)
        return Response(data if isinstance(data, list) else [])
    except Exception:
        return Response(
            {"detail": "Ошибка при обращении к внешнему API контактов"},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_external_contacts(request):
    """Import contacts from external API response into local DB."""
    contacts_list = request.data.get("contacts", [])
    org_name = request.data.get("organization_name", "")
    if not org_name:
        return Response(
            {"detail": "organization_name обязателен"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    org = Organization.objects.filter(name__icontains=org_name).first()
    if not org:
        return Response(
            {"detail": f"Организация '{org_name}' не найдена"},
            status=status.HTTP_404_NOT_FOUND,
        )

    created = 0
    for ext in contacts_list:
        c_type = ext.get("type", "other")
        defaults = {
            "comment": ext.get("comment", ""),
            "current": ext.get("current", True),
            "first_name": ext.get("first_name", ""),
            "last_name": ext.get("last_name", ""),
            "middle_name": ext.get("middle_name", ""),
            "position": ext.get("position", ""),
            "is_manager": ext.get("manager", False),
            "department_name": ext.get("department_name", ""),
        }
        if c_type == "person":
            Contact.objects.get_or_create(
                organization=org,
                type=c_type,
                first_name=defaults["first_name"],
                last_name=defaults["last_name"],
                middle_name=defaults["middle_name"],
                defaults=defaults,
            )
        elif c_type == "department":
            Contact.objects.get_or_create(
                organization=org,
                type=c_type,
                department_name=defaults["department_name"],
                defaults=defaults,
            )
        else:
            Contact.objects.create(organization=org, type=c_type, **defaults)
        created += 1

    return Response({"synced": created})


def _bitrix_request(endpoint, params=None):
    """Helper: make authenticated GET request to Bitrix API."""
    base_url = f"{settings.BITRIX_API_BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Token {settings.BITRIX_API_TOKEN}",
        "Accept": "application/json",
    }
    try:
        resp = http_requests.get(base_url, headers=headers, params=params, timeout=30)
        if resp.status_code == 404:
            logger.warning("Bitrix 404 for %s — body: %s", base_url, resp.text[:200])
            return []
        resp.raise_for_status()
        return resp.json()
    except http_requests.RequestException as exc:
        logger.error("Bitrix API error: %s", exc)
        raise


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def external_organizations(request):
    """Proxy to Bitrix organizations API with filtering.

    Supports multi-value `regions` and `fed_districts` (comma-separated):
    makes one Bitrix request per value and merges results by name.
    """
    base_params = {}
    single_param_map = {
        "type": "type",
        "region": "region",
        "region__contains": "region__contains",
        "fed_district": "fed_district",
        "fed_district__contains": "fed_district__contains",
        "prof_activity": "prof_activity",
        "prof_activity__contains": "prof_activity__contains",
        "federal": "federal",
        "is_active": "is_active",
        "project": "project",
        "date": "date",
    }
    for frontend_key, api_key in single_param_map.items():
        val = request.query_params.get(frontend_key)
        if val:
            base_params[api_key] = val

    # Build list of (param_key, value) pairs for multi-value filters
    multi_requests = []
    regions_raw = request.query_params.get("regions", "")
    fed_districts_raw = request.query_params.get("fed_districts", "")
    prof_activities_raw = request.query_params.get("prof_activities", "")
    regions_list = [r.strip() for r in regions_raw.split(",") if r.strip()]
    districts_list = [d.strip() for d in fed_districts_raw.split(",") if d.strip()]
    prof_activities_list = [p.strip() for p in prof_activities_raw.split(",") if p.strip()]

    # Build multi-dimensional combinations: (region/district) × prof_activity
    geo_filters = []
    if regions_list or districts_list:
        for r in regions_list:
            geo_filters.append(("region", r))
        for d in districts_list:
            geo_filters.append(("fed_district", d))
    else:
        geo_filters = [None]

    if prof_activities_list:
        combos = []
        for geo in geo_filters:
            for pa in prof_activities_list:
                combos.append((geo, pa))
        multi_requests = combos
    else:
        multi_requests = [(geo, None) for geo in geo_filters]

    try:
        seen_names: set = set()
        merged: list = []
        for geo_extra, pa_extra in multi_requests:
            params = dict(base_params)
            if geo_extra is not None:
                params[geo_extra[0]] = geo_extra[1]
            if pa_extra is not None:
                params["prof_activity__contains"] = pa_extra
            chunk = _bitrix_request("/contacts/api/organization/", params)
            if isinstance(chunk, list):
                for org in chunk:
                    name = org.get("name") or org.get("full_name", "")
                    if name not in seen_names:
                        seen_names.add(name)
                        merged.append(org)
        return Response(merged)
    except Exception:
        return Response(
            {"detail": "Ошибка при обращении к внешнему API"},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def external_fed_districts(request):
    """Proxy to Bitrix federal districts API."""
    try:
        data = _bitrix_request("/contacts/api/get_all/fed_district/")
        return Response(data)
    except Exception:
        return Response(
            {"detail": "Ошибка при обращении к внешнему API"},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def external_regions(request):
    """Proxy to Bitrix regions API."""
    try:
        data = _bitrix_request("/contacts/api/get_all/region/")
        return Response(data)
    except Exception:
        return Response(
            {"detail": "Ошибка при обращении к внешнему API"},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def external_org_types(request):
    """Proxy to Bitrix organization types API."""
    try:
        data = _bitrix_request("/contacts/api/get_all/organization_type/")
        return Response(data)
    except Exception:
        return Response(
            {"detail": "Ошибка при обращении к внешнему API"},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def external_prof_activities(request):
    """Proxy to Bitrix professional activities API."""
    try:
        data = _bitrix_request("/contacts/api/get_all/prof_activity/")
        return Response(data)
    except Exception:
        return Response(
            {"detail": "Ошибка при обращении к внешнему API"},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_external_organizations(request):
    """Create/update local Organization records from external org data."""
    org_list = request.data.get("organizations", [])
    created_count = 0
    updated_count = 0
    from apps.reference.models import Region

    region_cache = {}

    for ext_org in org_list:
        name = ext_org.get("name", "").strip()
        if not name:
            continue

        region_name = ext_org.get("region", "")
        region_obj = None
        if region_name:
            if region_name not in region_cache:
                region_cache[region_name] = Region.objects.filter(
                    name__iexact=region_name
                ).first()
            region_obj = region_cache[region_name]

        defaults = {
            "short_name": ext_org.get("name", "")[:200],
            "region": region_obj,
        }

        org, was_created = Organization.objects.update_or_create(
            name=ext_org.get("full_name") or name,
            defaults=defaults,
        )
        if was_created:
            created_count += 1
        else:
            updated_count += 1

    return Response({
        "created": created_count,
        "updated": updated_count,
        "total": created_count + updated_count,
    })

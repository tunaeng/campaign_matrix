import csv
import io

from rest_framework import viewsets, generics, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q

from .models import (
    FederalDistrict, Region, Profession, ProfessionDemandStatus,
    ProfessionApprovalStatus, Program, FederalOperator, Contract,
    ContractProgram, Quota,
)
from .serializers import (
    FederalDistrictSerializer, RegionSerializer, ProfessionSerializer,
    ProfessionDemandStatusSerializer, ProgramSerializer,
    FederalOperatorSerializer, ContractSerializer,
    ContractProgramSerializer, QuotaSerializer,
)


class FederalDistrictViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FederalDistrict.objects.prefetch_related("regions")
    serializer_class = FederalDistrictSerializer

    @action(detail=True, methods=["get"])
    def regions(self, request, pk=None):
        district = self.get_object()
        regions = district.regions.all()
        return Response(RegionSerializer(regions, many=True).data)


class RegionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Region.objects.select_related("federal_district")
    serializer_class = RegionSerializer
    filterset_fields = ["federal_district"]
    search_fields = ["name"]


class ProfessionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Profession.objects.all()
    serializer_class = ProfessionSerializer
    search_fields = ["name", "number"]

    @action(detail=True, methods=["get"], url_path="demand-map")
    def demand_map(self, request, pk=None):
        profession = self.get_object()
        year = request.query_params.get("year", 2026)
        statuses = ProfessionDemandStatus.objects.filter(
            profession=profession, year=year
        ).select_related("region")
        return Response(
            ProfessionDemandStatusSerializer(statuses, many=True).data
        )


class ProgramViewSet(viewsets.ModelViewSet):
    queryset = Program.objects.select_related("profession").prefetch_related(
        "contract_entries__contract__federal_operator"
    )
    serializer_class = ProgramSerializer
    filterset_fields = ["profession", "is_active"]
    search_fields = ["name", "profession__name"]

    def get_queryset(self):
        qs = super().get_queryset()
        contract_status = self.request.query_params.get("contract_status")
        operator = self.request.query_params.get("operator")

        if contract_status:
            qs = qs.filter(contract_entries__status=contract_status)
        if operator:
            qs = qs.filter(
                contract_entries__contract__federal_operator_id=operator
            )

        demanded_in_region = self.request.query_params.get("demanded_in_region")
        if demanded_in_region:
            qs = qs.filter(
                profession__demand_statuses__region_id=demanded_in_region,
                profession__demand_statuses__is_demanded=True,
            )

        demanded_only = self.request.query_params.get("demanded_only")
        if demanded_only and demanded_only.lower() == "true":
            qs = qs.filter(
                profession__demand_statuses__is_demanded=True,
            )

        return qs.distinct()


class FederalOperatorViewSet(viewsets.ModelViewSet):
    queryset = FederalOperator.objects.all()
    serializer_class = FederalOperatorSerializer
    search_fields = ["name"]


class ContractViewSet(viewsets.ModelViewSet):
    queryset = Contract.objects.select_related("federal_operator")
    serializer_class = ContractSerializer
    filterset_fields = ["federal_operator", "year", "status"]


class ContractProgramViewSet(viewsets.ModelViewSet):
    queryset = ContractProgram.objects.select_related("contract", "program")
    serializer_class = ContractProgramSerializer
    filterset_fields = ["contract", "program", "status"]


class QuotaViewSet(viewsets.ModelViewSet):
    queryset = Quota.objects.select_related(
        "federal_operator", "program", "region"
    )
    serializer_class = QuotaSerializer
    filterset_fields = ["federal_operator", "program", "region", "year"]


class DemandMatrixImportView(APIView):
    """
    CSV import for profession demand statuses.
    Upsert rules:
      - Profession: add if missing by number/name
      - Demand status: update_or_create by (profession, region, year)
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @staticmethod
    def _to_bool(value):
        if value is None:
            return False
        normalized = str(value).strip().lower()
        return normalized in {"1", "true", "yes", "y", "да", "д", "x", "+"}

    @staticmethod
    def _norm_header(value):
        return str(value).strip().lower().replace(" ", "_")

    def post(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response(
                {"detail": "Only admin can import demand matrix."},
                status=status.HTTP_403_FORBIDDEN,
            )

        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "File is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw = upload.read()
        decoded = None
        for enc in ("utf-8-sig", "cp1251", "utf-8"):
            try:
                decoded = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if decoded is None:
            return Response(
                {"detail": "Cannot decode file. Use UTF-8 or CP1251 CSV."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        csv_stream = io.StringIO(decoded)
        try:
            sample = decoded[:2048]
            delimiter = ";" if sample.count(";") >= sample.count(",") else ","
            reader = csv.DictReader(csv_stream, delimiter=delimiter)
        except Exception:
            return Response(
                {"detail": "Invalid CSV format."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not reader.fieldnames:
            return Response(
                {"detail": "CSV has no headers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        header_map = {self._norm_header(h): h for h in reader.fieldnames if h}

        def pick(*aliases):
            for alias in aliases:
                if alias in header_map:
                    return header_map[alias]
            return None

        profession_number_col = pick("profession_number", "number", "код_профессии")
        profession_name_col = pick("profession_name", "name", "профессия")
        region_col = pick("region_name", "region", "регион")
        region_code_col = pick("region_code", "код_региона")
        demanded_col = pick("is_demanded", "demanded", "востребована")
        year_col = pick("year", "год")

        if not demanded_col or (not profession_name_col and not profession_number_col):
            return Response(
                {
                    "detail": (
                        "Required columns: demanded + profession_name or profession_number. "
                        "Recommended: profession_number, profession_name, region_name, is_demanded, year."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        default_year = int(request.data.get("year") or 2026)

        region_by_name = {r.name.strip().lower(): r for r in Region.objects.all()}
        region_by_code = {str(r.code).strip().lower(): r for r in Region.objects.all()}
        profession_by_number = {
            p.number: p for p in Profession.objects.all() if p.number is not None
        }
        profession_by_name = {p.name.strip().lower(): p for p in Profession.objects.all()}

        created_professions = 0
        updated_professions = 0
        created_statuses = 0
        updated_statuses = 0
        skipped_rows = 0
        errors = []

        for row_idx, row in enumerate(reader, start=2):
            try:
                profession_number = None
                if profession_number_col:
                    raw_number = row.get(profession_number_col)
                    if raw_number not in (None, ""):
                        profession_number = int(str(raw_number).strip())

                profession_name = (
                    (row.get(profession_name_col) or "").strip()
                    if profession_name_col
                    else ""
                )
                if not profession_name and profession_number is None:
                    skipped_rows += 1
                    continue

                region = None
                if region_col:
                    region_name = (row.get(region_col) or "").strip().lower()
                    if region_name:
                        region = region_by_name.get(region_name)
                if region is None and region_code_col:
                    region_code = (row.get(region_code_col) or "").strip().lower()
                    if region_code:
                        region = region_by_code.get(region_code)
                if region is None:
                    skipped_rows += 1
                    continue

                is_demanded = self._to_bool(row.get(demanded_col))
                year = default_year
                if year_col and row.get(year_col) not in (None, ""):
                    year = int(str(row.get(year_col)).strip())

                profession = None
                if profession_number is not None:
                    profession = profession_by_number.get(profession_number)
                if profession is None and profession_name:
                    profession = profession_by_name.get(profession_name.lower())

                if profession is None:
                    # Add missing profession
                    new_number = profession_number
                    if new_number is None:
                        max_number = Profession.objects.order_by("-number").values_list(
                            "number", flat=True
                        ).first() or 0
                        new_number = max_number + 1
                    profession = Profession.objects.create(
                        number=new_number,
                        name=profession_name or f"Профессия {new_number}",
                    )
                    created_professions += 1
                    profession_by_number[profession.number] = profession
                    profession_by_name[profession.name.strip().lower()] = profession
                else:
                    # Update profession name if provided and changed
                    if profession_name and profession.name != profession_name:
                        profession.name = profession_name
                        profession.save(update_fields=["name"])
                        updated_professions += 1
                        profession_by_name[profession.name.strip().lower()] = profession

                obj, created = ProfessionDemandStatus.objects.update_or_create(
                    profession=profession,
                    region=region,
                    year=year,
                    defaults={"is_demanded": is_demanded},
                )
                if created:
                    created_statuses += 1
                else:
                    updated_statuses += 1
            except Exception as exc:  # noqa: BLE001
                errors.append(f"Row {row_idx}: {exc}")

        response = {
            "created_professions": created_professions,
            "updated_professions": updated_professions,
            "created_statuses": created_statuses,
            "updated_statuses": updated_statuses,
            "skipped_rows": skipped_rows,
            "errors_count": len(errors),
            "errors": errors[:20],
        }
        return Response(response, status=status.HTTP_200_OK)


class DemandMatrixView(generics.ListAPIView):
    """
    Returns profession demand matrix across all regions.
    Query params: year, profession_ids, region_ids, demanded_only, approval_statuses
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        year = int(request.query_params.get("year", 2026))
        profession_ids = request.query_params.get("profession_ids")
        region_ids = request.query_params.get("region_ids")
        demanded_only = request.query_params.get("demanded_only", "").lower() == "true"
        approval_statuses = request.query_params.get("approval_statuses")

        regions = Region.objects.all().order_by("name")
        if region_ids:
            ids = [int(x) for x in region_ids.split(",")]
            regions = regions.filter(id__in=ids)

        professions = Profession.objects.all().order_by("number")
        if profession_ids:
            ids = [int(x) for x in profession_ids.split(",")]
            professions = professions.filter(id__in=ids)
        
        # Filter by approval statuses
        if approval_statuses:
            status_list = approval_statuses.split(",")
            professions = professions.filter(
                approval_statuses__year=year,
                approval_statuses__approval_status__in=status_list
            ).distinct()

        statuses = ProfessionDemandStatus.objects.filter(year=year)
        if region_ids:
            ids = [int(x) for x in region_ids.split(",")]
            statuses = statuses.filter(region_id__in=ids)
        if profession_ids:
            ids = [int(x) for x in profession_ids.split(",")]
            statuses = statuses.filter(profession_id__in=ids)

        demand_map = {}
        for s in statuses:
            demand_map[(s.profession_id, s.region_id)] = s.is_demanded

        # Fetch approval statuses
        approvals = ProfessionApprovalStatus.objects.filter(year=year)
        if region_ids:
            ids = [int(x) for x in region_ids.split(",")]
            approvals = approvals.filter(region_id__in=ids)
        if profession_ids:
            ids = [int(x) for x in profession_ids.split(",")]
            approvals = approvals.filter(profession_id__in=ids)

        approval_map = {}
        for a in approvals:
            approval_map[(a.profession_id, a.region_id)] = a.approval_status

        region_list = list(regions.values("id", "name"))

        result = []
        for prof in professions:
            region_demands = {}
            region_approvals = {}
            has_any = False
            for r in region_list:
                val = demand_map.get((prof.id, r["id"]), False)
                region_demands[str(r["id"])] = val
                region_approvals[str(r["id"])] = approval_map.get(
                    (prof.id, r["id"]), None
                )
                if val:
                    has_any = True
            if demanded_only and not has_any:
                continue
            result.append({
                "profession_id": prof.id,
                "profession_number": prof.number,
                "profession_name": prof.name,
                "regions": region_demands,
                "approvals": region_approvals,
            })

        return Response({
            "regions": region_list,
            "professions": result,
            "year": year,
        })

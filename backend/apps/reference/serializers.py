from rest_framework import serializers
from .models import (
    FederalDistrict, Region, Profession, ProfessionDemandStatus,
    Program, FederalOperator, Contract, ContractProgram, Quota,
)


class FederalDistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = FederalDistrict
        fields = ["id", "name", "code", "short_name"]


class RegionSerializer(serializers.ModelSerializer):
    federal_district_name = serializers.CharField(
        source="federal_district.name", read_only=True
    )

    class Meta:
        model = Region
        fields = ["id", "name", "code", "federal_district", "federal_district_name"]


class RegionShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ["id", "name"]


class ProfessionSerializer(serializers.ModelSerializer):
    demanded_regions_count = serializers.SerializerMethodField()

    class Meta:
        model = Profession
        fields = ["id", "number", "name", "demanded_regions_count"]

    def get_demanded_regions_count(self, obj):
        year = self.context.get("year", 2026)
        return (
            obj.demand_statuses.filter(is_demanded=True, year=year)
            .values("region")
            .distinct()
            .count()
        )


class ProfessionDemandStatusSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source="region.name", read_only=True)
    profession_name = serializers.CharField(source="profession.name", read_only=True)
    federal_operator_name = serializers.CharField(
        source="federal_operator.display_name", read_only=True
    )

    class Meta:
        model = ProfessionDemandStatus
        fields = [
            "id", "federal_operator", "federal_operator_name",
            "profession", "profession_name",
            "region", "region_name", "is_demanded", "year",
        ]


class ProgramSerializer(serializers.ModelSerializer):
    profession_name = serializers.CharField(source="profession.name", read_only=True)
    profession_number = serializers.IntegerField(source="profession.number", read_only=True)
    contract_status = serializers.SerializerMethodField()

    class Meta:
        model = Program
        fields = [
            "id", "name", "profession", "profession_name", "profession_number",
            "description", "hours", "is_active", "contract_status",
        ]

    def get_contract_status(self, obj):
        entries = obj.contract_entries.select_related("contract").all()
        return [
            {
                "contract_id": e.contract_id,
                "operator": e.contract.federal_operator_id,
                "operator_name": e.contract.federal_operator.display_name if hasattr(e.contract, "federal_operator") else "",
                "status": e.status,
                "status_display": e.get_status_display(),
            }
            for e in entries
        ]


class FederalOperatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = FederalOperator
        fields = ["id", "name", "short_name", "description"]


class ContractSerializer(serializers.ModelSerializer):
    federal_operator_name = serializers.CharField(
        source="federal_operator.display_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Contract
        fields = [
            "id", "federal_operator", "federal_operator_name",
            "number", "year", "status", "status_display", "notes",
        ]


class ContractProgramSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source="program.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ContractProgram
        fields = [
            "id", "contract", "program", "program_name",
            "status", "status_display",
        ]


class QuotaSerializer(serializers.ModelSerializer):
    federal_operator_name = serializers.CharField(
        source="federal_operator.display_name", read_only=True
    )
    program_name = serializers.CharField(
        source="program.name", read_only=True, default=None
    )
    region_name = serializers.CharField(
        source="region.name", read_only=True, default=None
    )
    available = serializers.IntegerField(read_only=True)

    class Meta:
        model = Quota
        fields = [
            "id", "federal_operator", "federal_operator_name",
            "program", "program_name", "region", "region_name",
            "year", "total", "used", "available",
        ]


class DemandMatrixSerializer(serializers.Serializer):
    """Returns a matrix: professions x regions with demand status."""
    profession_id = serializers.IntegerField()
    profession_number = serializers.IntegerField()
    profession_name = serializers.CharField()
    regions = serializers.DictField(child=serializers.BooleanField())

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FederalDistrictViewSet, RegionViewSet, ProfessionViewSet,
    ProgramViewSet, FederalOperatorViewSet, ContractViewSet,
    ContractProgramViewSet, QuotaViewSet, DemandMatrixView,
    DemandMatrixImportView, DemandMatrixImportPreviewView,
    DemandMatrixImportApplyView,
)

router = DefaultRouter()
router.register("federal-districts", FederalDistrictViewSet)
router.register("regions", RegionViewSet)
router.register("professions", ProfessionViewSet)
router.register("programs", ProgramViewSet)
router.register("federal-operators", FederalOperatorViewSet)
router.register("contracts", ContractViewSet)
router.register("contract-programs", ContractProgramViewSet)
router.register("quotas", QuotaViewSet)

urlpatterns = [
    path("demand-matrix/", DemandMatrixView.as_view(), name="demand_matrix"),
    path("demand-matrix/import/", DemandMatrixImportView.as_view(), name="demand_matrix_import"),
    path("demand-matrix/import/preview/", DemandMatrixImportPreviewView.as_view(), name="demand_matrix_import_preview"),
    path("demand-matrix/import/apply/", DemandMatrixImportApplyView.as_view(), name="demand_matrix_import_apply"),
    path("", include(router.urls)),
]

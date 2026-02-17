from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.reference.urls")),
    path("api/", include("apps.organizations.urls")),
    path("api/", include("apps.campaigns.urls")),
]

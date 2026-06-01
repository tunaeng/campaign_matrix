from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import MeView, RoleDefinitionListView, UserListView

urlpatterns = [
    path("login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="auth_me"),
    path("users/", UserListView.as_view(), name="user_list"),
    path("roles/", RoleDefinitionListView.as_view(), name="role_list"),
]

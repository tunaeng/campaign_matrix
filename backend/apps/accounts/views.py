from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from .models import RoleDefinition, User
from .serializers import RoleDefinitionSerializer, UserSerializer, UserShortSerializer


class RolesPagination(PageNumberPagination):
    page_size = 50
    max_page_size = 500
    page_size_query_param = "page_size"


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserListView(generics.ListAPIView):
    """List users (for manager assignment dropdowns)."""
    serializer_class = UserShortSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = User.objects.filter(is_active=True)
    search_fields = ["first_name", "last_name", "username"]


class RoleDefinitionListView(generics.ListAPIView):
    serializer_class = RoleDefinitionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = RolesPagination

    def get_queryset(self):
        qs = RoleDefinition.objects.filter(is_active=True).order_by("name", "id")
        is_active = self.request.query_params.get("is_active")
        if is_active in ("0", "false", "False"):
            qs = RoleDefinition.objects.filter(is_active=False).order_by("name", "id")
        return qs

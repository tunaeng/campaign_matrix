from rest_framework import generics, permissions
from rest_framework.response import Response
from .models import User
from .serializers import UserSerializer, UserShortSerializer


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

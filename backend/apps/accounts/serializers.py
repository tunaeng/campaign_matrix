from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "patronymic", "phone", "role", "full_name", "is_active",
        ]
        read_only_fields = ["id", "username", "full_name"]

    def get_full_name(self, obj):
        parts = [obj.last_name, obj.first_name, obj.patronymic]
        return " ".join(p for p in parts if p)


class UserShortSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "role"]

    def get_full_name(self, obj):
        parts = [obj.last_name, obj.first_name]
        return " ".join(p for p in parts if p) or obj.username

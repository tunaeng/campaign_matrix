from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Администратор"
        MANAGER = "manager", "Менеджер по коммуникации"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MANAGER,
        verbose_name="Роль",
    )
    patronymic = models.CharField(
        max_length=150, blank=True, verbose_name="Отчество"
    )
    phone = models.CharField(
        max_length=20, blank=True, verbose_name="Телефон"
    )

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"
        ordering = ["last_name", "first_name"]

    def __str__(self):
        full = f"{self.last_name} {self.first_name}".strip()
        return full or self.username

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN


class RoleDefinition(models.Model):
    class ScopeType(models.TextChoices):
        GLOBAL = "global", "Глобальная"
        CAMPAIGN = "campaign", "Кампания"
        FUNNEL = "funnel", "Воронка"
        SUBFUNNEL = "subfunnel", "Подворонка"

    code = models.SlugField(max_length=80, unique=True, verbose_name="Код")
    name = models.CharField(max_length=200, verbose_name="Название")
    description = models.TextField(blank=True, default="", verbose_name="Описание")
    scope_type = models.CharField(
        max_length=20,
        choices=ScopeType.choices,
        default=ScopeType.GLOBAL,
        verbose_name="Область применения",
    )
    is_active = models.BooleanField(default=True, verbose_name="Активна")
    is_system = models.BooleanField(default=False, verbose_name="Системная")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Роль (справочник)"
        verbose_name_plural = "Роли (справочник)"
        ordering = ["name", "id"]

    def __str__(self):
        return self.name

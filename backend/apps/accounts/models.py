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

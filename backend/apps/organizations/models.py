from django.conf import settings
from django.db import models


class Organization(models.Model):
    class OrgType(models.TextChoices):
        MINISTRY = "ministry", "Министерство/ведомство"
        ENTERPRISE = "enterprise", "Предприятие"
        EDUCATION = "education", "Образовательная организация"
        HEALTHCARE = "healthcare", "Учреждение здравоохранения"
        MUNICIPAL = "municipal", "Муниципальное учреждение"
        OTHER = "other", "Другое"

    name = models.CharField(max_length=500, verbose_name="Наименование")
    short_name = models.CharField(
        max_length=200, blank=True, verbose_name="Краткое наименование"
    )
    inn = models.CharField(max_length=12, blank=True, verbose_name="ИНН")
    org_type = models.CharField(
        max_length=20,
        choices=OrgType.choices,
        default=OrgType.OTHER,
        verbose_name="Тип организации",
    )
    region = models.ForeignKey(
        "reference.Region",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="organizations",
        verbose_name="Регион",
    )
    parent_organization = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subsidiaries",
        verbose_name="Головная организация",
    )
    contact_person = models.CharField(
        max_length=300, blank=True, verbose_name="Контактное лицо"
    )
    contact_email = models.EmailField(blank=True, verbose_name="Email")
    contact_phone = models.CharField(
        max_length=20, blank=True, verbose_name="Телефон"
    )
    notes = models.TextField(blank=True, verbose_name="Примечания")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Организация"
        verbose_name_plural = "Организации"
        ordering = ["name"]

    def __str__(self):
        return self.short_name or self.name

    @property
    def has_interaction_history(self):
        return self.interactions.exists()


class OrganizationInteraction(models.Model):
    class InteractionType(models.TextChoices):
        EMAIL = "email", "Email"
        PHONE = "phone", "Телефонный звонок"
        MEETING = "meeting", "Встреча"
        LETTER = "letter", "Письмо"
        OTHER = "other", "Другое"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="interactions",
        verbose_name="Организация",
    )
    date = models.DateField(verbose_name="Дата")
    interaction_type = models.CharField(
        max_length=20,
        choices=InteractionType.choices,
        default=InteractionType.OTHER,
        verbose_name="Тип взаимодействия",
    )
    notes = models.TextField(blank=True, verbose_name="Описание")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Менеджер",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Взаимодействие"
        verbose_name_plural = "История взаимодействий"
        ordering = ["-date"]

    def __str__(self):
        return f"{self.organization} — {self.get_interaction_type_display()} ({self.date})"

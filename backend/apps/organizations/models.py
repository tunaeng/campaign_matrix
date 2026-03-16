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


class Contact(models.Model):
    class ContactType(models.TextChoices):
        PERSON = "person", "Физическое лицо"
        DEPARTMENT = "department", "Отдел"
        MAIN = "main", "Основной"
        OTHER = "other", "Другое"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="contacts",
        verbose_name="Организация",
    )
    type = models.CharField(
        max_length=20,
        choices=ContactType.choices,
        default=ContactType.PERSON,
        verbose_name="Тип контакта",
    )
    comment = models.TextField(blank=True, verbose_name="Комментарий")
    current = models.BooleanField(default=True, verbose_name="Актуальный")
    first_name = models.CharField(max_length=200, blank=True, verbose_name="Имя")
    last_name = models.CharField(max_length=200, blank=True, verbose_name="Фамилия")
    middle_name = models.CharField(max_length=200, blank=True, verbose_name="Отчество")
    position = models.CharField(max_length=300, blank=True, verbose_name="Должность")
    phone = models.CharField(max_length=50, blank=True, verbose_name="Телефон")
    email = models.EmailField(blank=True, verbose_name="Email")
    messenger = models.CharField(max_length=300, blank=True, verbose_name="Мессенджер")
    is_manager = models.BooleanField(default=False, verbose_name="Руководитель")
    department_name = models.CharField(
        max_length=300, blank=True, verbose_name="Название отдела"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Контакт"
        verbose_name_plural = "Контакты"
        ordering = ["-current", "last_name", "first_name"]

    def __str__(self):
        if self.type == self.ContactType.PERSON:
            return f"{self.last_name} {self.first_name} {self.middle_name}".strip() or "—"
        if self.type == self.ContactType.DEPARTMENT:
            return self.department_name or "—"
        return f"{self.get_type_display()} ({self.organization})"

    @property
    def full_name(self):
        return f"{self.last_name} {self.first_name} {self.middle_name}".strip()


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

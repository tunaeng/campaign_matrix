from django.conf import settings
from django.db import models


class OrganizationTag(models.Model):
    class TagType(models.TextChoices):
        ALL = "all", "Все сущности"
        ORGANIZATIONS = "organizations", "Организации"
        CONTACTS = "contacts", "Контакты"
        FUNNELS = "funnels", "Воронки"
        CAMPAIGNS = "campaigns", "Кампании"
        LEADS = "leads", "Лиды"

    name = models.CharField(max_length=100, unique=True, verbose_name="Название")
    slug = models.SlugField(
        max_length=120, unique=True, allow_unicode=True, verbose_name="Код"
    )
    color = models.CharField(max_length=20, blank=True, verbose_name="Цвет")
    tag_type = models.CharField(
        max_length=20,
        choices=TagType.choices,
        default=TagType.ALL,
        verbose_name="Тип",
    )
    category = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Категория",
        help_text="Необязательная папка для группировки тегов в фильтрах",
    )

    class Meta:
        verbose_name = "Тег"
        verbose_name_plural = "Теги"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Organization(models.Model):
    class OrgType(models.TextChoices):
        ROIV = "roiv", "РОИВ"
        FEDERAL = "federal", "Федеральная"
        MUNICIPAL = "municipal", "Муниципальная"
        PRIVATE = "private", "Коммерческая"
        COMPANY_BRANCH = "company_branch", "Подразделение компании (без ИНН)"
        OTHER = "other", "Другое"

    name = models.CharField(max_length=500, verbose_name="Наименование")
    short_name = models.CharField(
        max_length=200, blank=True, verbose_name="Краткое наименование"
    )
    inn = models.CharField(
        max_length=12,
        blank=True,
        null=True,
        verbose_name="ИНН",
        help_text="Для подразделений без собственного ИНН оставьте пустым и укажите головную организацию.",
    )
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
        max_length=50, blank=True, verbose_name="Телефон"
    )
    contact_phone_extension = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Добавочный",
    )
    is_our_side = models.BooleanField(default=False, verbose_name="Наша организация")
    description = models.TextField(blank=True, verbose_name="Описание")
    tags = models.ManyToManyField(
        OrganizationTag,
        blank=True,
        related_name="organizations",
        verbose_name="Теги",
    )
    notes = models.TextField(blank=True, verbose_name="Примечания")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Организация"
        verbose_name_plural = "Организации"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["inn"],
                condition=models.Q(inn__isnull=False) & ~models.Q(inn=""),
                name="organization_inn_unique_when_set",
            ),
        ]

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
    phone_extension = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Добавочный",
    )
    email = models.EmailField(blank=True, verbose_name="Email")
    messenger = models.CharField(max_length=300, blank=True, verbose_name="Мессенджер")
    is_manager = models.BooleanField(default=False, verbose_name="Руководитель")
    department_name = models.CharField(
        max_length=300, blank=True, verbose_name="Название отдела"
    )
    bitrix_contact_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        unique=True,
        verbose_name="ID контакта в Bitrix",
    )
    tags = models.ManyToManyField(
        OrganizationTag,
        blank=True,
        related_name="contacts",
        verbose_name="Теги",
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


class EntityFieldChange(models.Model):
    class Source(models.TextChoices):
        MANUAL = "manual", "Ручное изменение"
        BULK = "bulk", "Массовое изменение"
        SYNC = "sync", "Синхронизация"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="field_changes",
        null=True,
        blank=True,
        verbose_name="Организация",
    )
    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        related_name="field_changes",
        null=True,
        blank=True,
        verbose_name="Контакт",
    )
    field_name = models.CharField(max_length=120, verbose_name="Поле")
    old_value = models.TextField(blank=True, verbose_name="Старое значение")
    new_value = models.TextField(blank=True, verbose_name="Новое значение")
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
        verbose_name="Источник",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entity_field_changes",
        verbose_name="Кто изменил",
    )
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name="Когда изменено")

    class Meta:
        verbose_name = "Изменение поля"
        verbose_name_plural = "Изменения полей"
        ordering = ["-changed_at", "-id"]
        indexes = [
            models.Index(fields=["organization", "-changed_at"]),
            models.Index(fields=["contact", "-changed_at"]),
        ]

    def __str__(self):
        if self.organization_id:
            target = f"org#{self.organization_id}"
        elif self.contact_id:
            target = f"contact#{self.contact_id}"
        else:
            target = "entity"
        return f"{target}: {self.field_name}"


class ImportBatch(models.Model):
    class EntityType(models.TextChoices):
        ORGANIZATIONS = "organizations", "Организации"
        CONTACTS = "contacts", "Контакты"

    class Status(models.TextChoices):
        COMPLETED = "completed", "Завершён"
        ROLLED_BACK = "rolled_back", "Откат выполнен"

    entity_type = models.CharField(
        max_length=20,
        choices=EntityType.choices,
        verbose_name="Тип сущности",
    )
    file_name = models.CharField(max_length=255, verbose_name="Имя файла")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batches",
        verbose_name="Загрузил",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата загрузки")
    created_count = models.PositiveIntegerField(default=0, verbose_name="Создано")
    updated_count = models.PositiveIntegerField(default=0, verbose_name="Обновлено")
    skipped_count = models.PositiveIntegerField(default=0, verbose_name="Пропущено")
    total_rows = models.PositiveIntegerField(default=0, verbose_name="Строк в файле")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.COMPLETED,
        verbose_name="Статус",
    )
    rolled_back_at = models.DateTimeField(null=True, blank=True, verbose_name="Дата отката")
    rolled_back_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rolled_back_import_batches",
        verbose_name="Откатил",
    )

    class Meta:
        verbose_name = "Пакет импорта"
        verbose_name_plural = "Пакеты импорта"
        ordering = ["-uploaded_at", "-id"]

    def __str__(self):
        return f"{self.file_name} ({self.get_entity_type_display()})"


class ImportBatchRecord(models.Model):
    class Action(models.TextChoices):
        CREATED = "created", "Создано"
        UPDATED = "updated", "Обновлено"

    batch = models.ForeignKey(
        ImportBatch,
        on_delete=models.CASCADE,
        related_name="records",
        verbose_name="Пакет импорта",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batch_records",
        verbose_name="Организация",
    )
    contact = models.ForeignKey(
        Contact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batch_records",
        verbose_name="Контакт",
    )
    action = models.CharField(max_length=20, choices=Action.choices, verbose_name="Действие")
    snapshot = models.JSONField(default=dict, blank=True, verbose_name="Снимок до изменения")

    class Meta:
        verbose_name = "Запись пакета импорта"
        verbose_name_plural = "Записи пакетов импорта"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["batch", "action"]),
        ]

    def __str__(self):
        target = self.organization_id or self.contact_id or "?"
        return f"{self.get_action_display()} #{target}"


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
    project = models.ForeignKey(
        "organizations.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="interactions",
        verbose_name="Проект",
    )
    acting_organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acting_interactions",
        verbose_name="От нашей организации",
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


class Project(models.Model):
    name = models.CharField(max_length=300, verbose_name="Название")
    year = models.PositiveSmallIntegerField(verbose_name="Год")
    code = models.CharField(max_length=100, blank=True, verbose_name="Код")
    organizations = models.ManyToManyField(
        Organization,
        through="ProjectOrganizationMembership",
        related_name="projects",
        verbose_name="Организации",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Проект"
        verbose_name_plural = "Проекты"
        ordering = ["-year", "name"]
        constraints = [
            models.UniqueConstraint(fields=["name", "year"], name="project_name_year_unique"),
        ]

    def __str__(self):
        return f"{self.name} ({self.year})"


class ProjectOrganizationMembershipRole(models.TextChoices):
    CUSTOMER = "customer", "Заказчик"
    FEDERAL_OPERATOR = "federal_operator", "Федеральный оператор"
    PARTICIPANT = "participant", "Участник"
    CONTRACTOR = "contractor", "Подрядчик"
    IMPLEMENTER = "implementer", "Исполнитель"


class ProjectOrganizationMembership(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships",
        verbose_name="Проект",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="project_memberships",
        verbose_name="Организация",
    )
    role = models.CharField(
        max_length=40,
        choices=ProjectOrganizationMembershipRole.choices,
        verbose_name="Роль",
    )
    notes = models.TextField(blank=True, verbose_name="Примечания")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="Порядок")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Роль организации в проекте"
        verbose_name_plural = "Роли организаций в проектах"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "organization", "role"],
                name="project_org_role_unique",
            ),
            models.UniqueConstraint(
                fields=["project"],
                condition=models.Q(role=ProjectOrganizationMembershipRole.CUSTOMER),
                name="project_single_customer_unique",
            ),
        ]

    def __str__(self):
        return f"{self.project} — {self.organization} ({self.get_role_display()})"


class UserActingOrganization(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="acting_organizations",
        verbose_name="Пользователь",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="assigned_users",
        verbose_name="Организация",
    )
    is_primary = models.BooleanField(default=False, verbose_name="Основная")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Организация пользователя"
        verbose_name_plural = "Организации пользователей"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "organization"],
                name="user_acting_organization_unique",
            )
        ]

    def __str__(self):
        return f"{self.user} — {self.organization}"


class BitrixOAuthConnection(models.Model):
    title = models.CharField(max_length=150, default="default", unique=True)
    client_id = models.CharField(max_length=255, blank=True)
    client_secret = models.CharField(max_length=255, blank=True)
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    base_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Bitrix OAuth подключение"
        verbose_name_plural = "Bitrix OAuth подключения"

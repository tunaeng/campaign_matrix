from django.conf import settings
from django.db import models
from django.db.models import Q


class Campaign(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        ACTIVE = "active", "В работе"
        PAUSED = "paused", "Приостановлена"
        COMPLETED = "completed", "Завершена"

    class OperationalStage(models.TextChoices):
        ORGANIZATION_LIST = "organization_list", "Формирование перечня организаций"

    name = models.CharField(max_length=500, verbose_name="Название кампании")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="Статус",
    )
    operational_stage = models.CharField(
        max_length=40,
        choices=OperationalStage.choices,
        blank=True,
        default="",
        verbose_name="Стадия кампании",
        help_text="Операционная стадия жизненного цикла кампании (отдельно от статуса и стадий воронки лидов)",
    )
    federal_operator = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaigns",
        verbose_name="Федеральный оператор",
    )
    federal_operators = models.ManyToManyField(
        "organizations.Organization",
        blank=True,
        related_name="campaigns_as_federal_operator",
        verbose_name="Федеральные операторы",
    )
    project = models.ForeignKey(
        "organizations.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaigns",
        verbose_name="Проект",
    )
    acting_organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acting_campaigns",
        verbose_name="От нашей организации",
    )
    funnels = models.ManyToManyField(
        "funnels.Funnel",
        through="CampaignFunnel",
        blank=True,
        related_name="campaigns",
        verbose_name="Воронки",
    )
    hypothesis = models.TextField(
        blank=True, verbose_name="Гипотеза"
    )
    hypothesis_result = models.TextField(
        blank=True, verbose_name="Результат проверки гипотезы"
    )
    collect_search_task = models.TextField(
        blank=True,
        default="",
        verbose_name="Задание на поиск",
        help_text="Краткий бриф по типу организаций и контактов для стадии сбора лидов",
    )
    tags = models.ManyToManyField(
        "organizations.OrganizationTag",
        blank=True,
        related_name="campaigns",
        verbose_name="Теги",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_campaigns",
        verbose_name="Создал",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Кампания"
        verbose_name_plural = "Кампании"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    @property
    def total_demand(self):
        forecast = (
            self.leads.aggregate(
                total=models.Sum("forecast_demand")
            )["total"]
            or 0
        )
        return forecast

    @property
    def organizations_count(self):
        return self.organizations.count()

    @property
    def leads_count(self):
        return self.leads.count()


class CampaignQueue(models.Model):
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="queues",
        verbose_name="Кампания",
    )
    queue_number = models.IntegerField(verbose_name="Номер очереди")
    name = models.CharField(
        max_length=200, blank=True, verbose_name="Название очереди"
    )
    start_date = models.DateField(
        null=True, blank=True, verbose_name="Дата начала"
    )
    end_date = models.DateField(
        null=True, blank=True, verbose_name="Дата окончания"
    )

    class Meta:
        verbose_name = "Очередь кампании"
        verbose_name_plural = "Очереди кампании"
        ordering = ["queue_number"]
        unique_together = ["campaign", "queue_number"]

    def __str__(self):
        return self.name or f"Очередь {self.queue_number}"


class CampaignFunnel(models.Model):
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="campaign_funnels",
        verbose_name="Кампания",
    )
    funnel = models.ForeignKey(
        "funnels.Funnel",
        on_delete=models.CASCADE,
        related_name="campaign_funnels",
        verbose_name="Воронка",
    )

    class Meta:
        verbose_name = "Воронка в кампании"
        verbose_name_plural = "Воронки в кампании"
        unique_together = ["campaign", "funnel"]

    def __str__(self):
        return f"{self.campaign.name} — {self.funnel.name}"


class QueueStageDeadline(models.Model):
    queue = models.ForeignKey(
        CampaignQueue,
        on_delete=models.CASCADE,
        related_name="stage_deadlines",
        verbose_name="Очередь",
    )
    funnel_stage = models.ForeignKey(
        "funnels.FunnelStage",
        on_delete=models.CASCADE,
        related_name="queue_deadlines",
        verbose_name="Стадия воронки",
    )
    deadline_days = models.PositiveIntegerField(
        verbose_name="Дедлайн (раб. дней от старта очереди)",
    )

    class Meta:
        verbose_name = "Дедлайн стадии в очереди"
        verbose_name_plural = "Дедлайны стадий в очередях"
        unique_together = ["queue", "funnel_stage"]

    def __str__(self):
        return f"{self.queue} — {self.funnel_stage.name}: {self.deadline_days} дн."


class CampaignProgram(models.Model):
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="campaign_programs",
        verbose_name="Кампания",
    )
    program = models.ForeignKey(
        "reference.Program",
        on_delete=models.CASCADE,
        related_name="campaign_entries",
        verbose_name="Программа",
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_campaign_programs",
        verbose_name="Ответственный менеджер",
    )

    class Meta:
        verbose_name = "Программа в кампании"
        verbose_name_plural = "Программы в кампании"
        unique_together = ["campaign", "program"]

    def __str__(self):
        return f"{self.campaign.name} — {self.program.name}"


class CampaignRegion(models.Model):
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="campaign_regions",
        verbose_name="Кампания",
    )
    region = models.ForeignKey(
        "reference.Region",
        on_delete=models.CASCADE,
        related_name="campaign_entries",
        verbose_name="Регион",
    )
    queue = models.ForeignKey(
        CampaignQueue,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="regions",
        verbose_name="Очередь",
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_campaign_regions",
        verbose_name="Ответственный менеджер",
    )
    primary_contact_specialist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="specialist_campaign_regions",
        verbose_name="Специалист по первичному контакту",
    )
    demand_quota = models.PositiveIntegerField(
        default=0,
        verbose_name="Квота региона (чел.)",
    )
    search_task = models.TextField(
        blank=True,
        default="",
        verbose_name="Задание на поиск в регионе",
    )

    class Meta:
        verbose_name = "Регион в кампании"
        verbose_name_plural = "Регионы в кампании"
        unique_together = ["campaign", "region"]

    def __str__(self):
        return f"{self.campaign.name} — {self.region.name}"


class CampaignOrganization(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает"
        CONTACTED = "contacted", "Связались"
        INTERESTED = "interested", "Заинтересован"
        DECLINED = "declined", "Отказ"
        DEMAND_RECEIVED = "demand_received", "Потребность получена"

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="organizations",
        verbose_name="Кампания",
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="campaign_entries",
        verbose_name="Организация",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="Статус",
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_campaign_organizations",
        verbose_name="Ответственный менеджер",
    )
    demand_count = models.IntegerField(
        default=0, verbose_name="Заявленная потребность (чел.)"
    )
    notes = models.TextField(blank=True, verbose_name="Примечания")

    class Meta:
        verbose_name = "Организация в кампании"
        verbose_name_plural = "Организации в кампании"
        unique_together = ["campaign", "organization"]

    def __str__(self):
        return f"{self.campaign.name} — {self.organization.name}"


class Lead(models.Model):
    class PrimaryContactStatus(models.TextChoices):
        NEW = "new", "Новый"
        EMAIL_PREPARED = "email_prepared", "Письмо подготовлено"
        EMAIL_SENT = "email_sent", "Письмо отправлено"
        RESPONSE_RECEIVED = "response_received", "Ответ получен"
        RESULT_RECORDED = "result_recorded", "Результат зафиксирован"
        REJECTED = "rejected", "Отказ"

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="leads",
        verbose_name="Кампания",
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="leads",
        verbose_name="Организация",
    )
    region = models.ForeignKey(
        "reference.Region",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
        verbose_name="Регион лида",
    )
    funnel = models.ForeignKey(
        "funnels.Funnel",
        on_delete=models.CASCADE,
        related_name="leads",
        verbose_name="Воронка",
    )
    queue = models.ForeignKey(
        CampaignQueue,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
        verbose_name="Очередь",
    )
    current_stage = models.ForeignKey(
        "funnels.FunnelStage",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_leads",
        verbose_name="Текущая стадия",
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_leads",
        verbose_name="Ответственный менеджер",
    )
    primary_contact_specialist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="specialist_leads",
        verbose_name="Специалист по первичному контакту",
    )
    primary_contact_status = models.CharField(
        max_length=30,
        choices=PrimaryContactStatus.choices,
        default=PrimaryContactStatus.NEW,
        verbose_name="Статус первичного контакта",
    )
    primary_contact_result = models.TextField(
        blank=True,
        default="",
        verbose_name="Результат первичного контакта",
    )
    forecast_demand = models.IntegerField(
        null=True, blank=True, verbose_name="Прогноз потребности (чел.)"
    )
    demand_count = models.IntegerField(
        default=0, verbose_name="Фактическая потребность (чел.)"
    )
    demand_collected_declared = models.IntegerField(
        default=0, verbose_name="Собрано по заявленной квоте (чел.)"
    )
    demand_collected_list = models.IntegerField(
        default=0, verbose_name="Собрано по списочной квоте (чел.)"
    )
    demand_quota_declared = models.IntegerField(
        default=0, verbose_name="Квота заявленная (чел.)"
    )
    demand_quota_list = models.IntegerField(
        default=0, verbose_name="Квота списочная (чел.)"
    )
    notes = models.TextField(blank=True, verbose_name="Примечания")
    primary_contact = models.ForeignKey(
        "organizations.Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="primary_for_leads",
        verbose_name="Основной контакт",
    )
    tags = models.ManyToManyField(
        "organizations.OrganizationTag",
        blank=True,
        related_name="leads",
        verbose_name="Теги",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Лид"
        verbose_name_plural = "Лиды"
        unique_together = ["campaign", "organization", "funnel", "region"]
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization"],
                condition=Q(primary_contact__isnull=False),
                name="lead_org_single_primary_contact",
            ),
        ]

    def __str__(self):
        if self.region_id:
            return f"{self.organization} ({self.region}) [{self.funnel}]"
        return f"{self.organization} [{self.funnel}]"

    def get_stage_deadline(self, stage):
        """Compute deadline date for a given stage based on queue start_date."""
        if not self.queue or not self.queue.start_date:
            return None
        override = QueueStageDeadline.objects.filter(
            queue=self.queue, funnel_stage=stage
        ).first()
        days = override.deadline_days if override else stage.deadline_days
        if not days:
            return None
        from apps.campaigns.utils import add_business_days
        return add_business_days(self.queue.start_date, days)


class CampaignSubfunnel(models.Model):
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="subfunnels",
        verbose_name="Кампания",
    )
    funnel = models.ForeignKey(
        "funnels.Funnel",
        on_delete=models.CASCADE,
        related_name="campaign_subfunnels",
        verbose_name="Основная воронка",
    )
    template = models.ForeignKey(
        "funnels.SubfunnelTemplate",
        on_delete=models.CASCADE,
        related_name="campaign_subfunnels",
        verbose_name="Шаблон подворонки",
    )
    binding = models.ForeignKey(
        "funnels.SubfunnelTemplateBinding",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaign_subfunnels",
        verbose_name="Привязка шаблона",
    )
    role = models.ForeignKey(
        "accounts.RoleDefinition",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaign_subfunnels",
        verbose_name="Роль",
    )
    default_assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaign_subfunnels_default_assignee",
        verbose_name="Исполнитель по умолчанию",
    )
    template_version = models.PositiveIntegerField(default=1, verbose_name="Версия шаблона")
    is_active = models.BooleanField(default=True, verbose_name="Активна")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Подворонка кампании"
        verbose_name_plural = "Подворонки кампаний"
        ordering = ["campaign_id", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "template", "binding"],
                name="unique_campaign_subfunnel_template_binding",
            )
        ]

    def __str__(self):
        return f"{self.campaign.name} → {self.template.name}"


class LeadSubfunnel(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "К выполнению"
        IN_PROGRESS = "in_progress", "В работе"
        BLOCKED = "blocked", "Блокировано"
        DONE = "done", "Готово"

    campaign_subfunnel = models.ForeignKey(
        CampaignSubfunnel,
        on_delete=models.CASCADE,
        related_name="lead_subfunnels",
        verbose_name="Подворонка кампании",
    )
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subfunnels",
        verbose_name="Лид",
    )
    campaign_region = models.ForeignKey(
        CampaignRegion,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="region_tasks",
        verbose_name="Регион кампании",
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.TODO,
        verbose_name="Статус",
    )
    current_template_stage = models.ForeignKey(
        "funnels.TaskTemplateStage",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_subfunnels",
        verbose_name="Текущий этап шаблона задачи",
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_subfunnels_assignee",
        verbose_name="Исполнитель",
    )
    started_at = models.DateTimeField(null=True, blank=True, verbose_name="Старт")
    due_at = models.DateTimeField(null=True, blank=True, verbose_name="Дедлайн")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="Завершено")
    is_available = models.BooleanField(
        default=True,
        verbose_name="Доступна на текущей стадии",
        help_text="Для диапазонных подворонок availability вычисляется по стадии лида.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Подворонка лида"
        verbose_name_plural = "Подворонки лидов"
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["campaign_subfunnel", "lead"],
                condition=models.Q(lead__isnull=False),
                name="unique_lead_subfunnel_per_campaign_subfunnel",
            ),
            models.UniqueConstraint(
                fields=["campaign_subfunnel", "campaign_region"],
                condition=models.Q(campaign_region__isnull=False),
                name="unique_region_subfunnel_per_campaign_subfunnel",
            ),
            models.CheckConstraint(
                check=(
                    models.Q(lead__isnull=False, campaign_region__isnull=True)
                    | models.Q(lead__isnull=True, campaign_region__isnull=False)
                ),
                name="lead_subfunnel_lead_xor_campaign_region",
            ),
        ]

    def __str__(self):
        if self.campaign_region_id:
            return f"{self.campaign_region} — {self.campaign_subfunnel.template.name}"
        return f"{self.lead} — {self.campaign_subfunnel.template.name}"

    @staticmethod
    def status_from_stage(stage):
        if not stage:
            return LeadSubfunnel.Status.TODO
        if stage.is_terminal:
            return LeadSubfunnel.Status.DONE
        if stage.order <= 0:
            return LeadSubfunnel.Status.TODO
        return LeadSubfunnel.Status.IN_PROGRESS


class LeadSubfunnelChecklistValue(models.Model):
    lead_subfunnel = models.ForeignKey(
        LeadSubfunnel,
        on_delete=models.CASCADE,
        related_name="checklist_values",
        verbose_name="Подворонка лида",
    )
    template_item = models.ForeignKey(
        "funnels.SubfunnelTemplateItem",
        on_delete=models.CASCADE,
        related_name="lead_values",
        verbose_name="Пункт шаблона",
    )
    is_completed = models.BooleanField(default=False, verbose_name="Выполнен")
    text_value = models.TextField(blank=True, default="", verbose_name="Комментарий")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="Когда выполнен")
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="completed_lead_subfunnel_values",
        verbose_name="Кем выполнен",
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_lead_subfunnel_values",
        verbose_name="Исполнитель пункта",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Значение чек-листа подворонки"
        verbose_name_plural = "Значения чек-листа подворонки"
        ordering = ["template_item__order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["lead_subfunnel", "template_item"],
                name="unique_lead_subfunnel_template_item_value",
            )
        ]

    def __str__(self):
        return f"{self.lead_subfunnel} — {self.template_item.title}"


class LeadChecklistValue(models.Model):
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="checklist_values",
        verbose_name="Лид",
    )
    checklist_item = models.ForeignKey(
        "funnels.StageChecklistItem",
        on_delete=models.CASCADE,
        related_name="lead_values",
        verbose_name="Пункт чек-листа",
    )
    is_completed = models.BooleanField(default=False, verbose_name="Выполнен")
    text_value = models.TextField(blank=True, verbose_name="Текстовое значение")
    file_value = models.FileField(
        upload_to="lead_files/", blank=True, verbose_name="Файл"
    )
    select_value = models.CharField(
        max_length=300, blank=True, verbose_name="Выбранное значение"
    )
    contact = models.ForeignKey(
        "organizations.Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checklist_values",
        verbose_name="Контакт",
    )
    contact_name = models.CharField(max_length=300, blank=True, verbose_name="ФИО контакта")
    contact_position = models.CharField(max_length=300, blank=True, verbose_name="Должность")
    contact_phone = models.CharField(max_length=50, blank=True, verbose_name="Телефон")
    contact_email = models.EmailField(blank=True, verbose_name="Email")
    contact_messenger = models.CharField(max_length=300, blank=True, verbose_name="Мессенджер")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="Дата выполнения")
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Выполнил",
    )
    primary_contact_specialist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="specialist_checklist_values",
        verbose_name="Ответственный специалист",
    )

    class Meta:
        verbose_name = "Значение чек-листа лида"
        verbose_name_plural = "Значения чек-листа лидов"
        unique_together = ["lead", "checklist_item"]

    def __str__(self):
        return f"{self.lead} — {self.checklist_item.text}"


class LeadChecklistAttachment(models.Model):
    """Несколько файлов на один пункт чек-листа (раньше был только file_value)."""

    checklist_value = models.ForeignKey(
        LeadChecklistValue,
        on_delete=models.CASCADE,
        related_name="attachments",
        verbose_name="Значение чек-листа",
    )
    file = models.FileField(upload_to="lead_files/", verbose_name="Файл")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Вложение чек-листа"
        verbose_name_plural = "Вложения чек-листа"
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.checklist_value_id} — {self.file.name}"


class LeadInteraction(models.Model):
    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        PHONE = "phone", "Телефон"
        MEETING = "meeting", "Встреча"
        MESSENGER = "messenger", "Мессенджер"
        LETTER = "letter", "Письмо"
        OTHER = "other", "Другое"

    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="interactions",
        verbose_name="Лид",
    )
    contact = models.ForeignKey(
        "organizations.Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_interactions",
        verbose_name="Контакт",
    )
    contact_person = models.CharField(max_length=300, verbose_name="С кем общались")
    contact_position = models.CharField(
        max_length=300, blank=True, verbose_name="Должность"
    )
    date = models.DateTimeField(verbose_name="Дата и время")
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        default=Channel.OTHER,
        verbose_name="Канал",
    )
    result = models.TextField(blank=True, verbose_name="Результат")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Менеджер",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Взаимодействие по лиду"
        verbose_name_plural = "Взаимодействия по лидам"
        ordering = ["-date"]

    def __str__(self):
        return f"{self.lead} — {self.get_channel_display()} ({self.date})"


class LeadActivityLog(models.Model):
    """Журнал: смена стадии и изменения чек-листа (для общей ленты с взаимодействиями)."""

    class EventType(models.TextChoices):
        STAGE = "stage", "Стадия"
        CHECKLIST = "checklist", "Чек-лист"

    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="activity_logs",
        verbose_name="Лид",
    )
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        verbose_name="Тип",
    )
    summary = models.CharField(max_length=500, verbose_name="Описание")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Когда")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_activity_logs",
        verbose_name="Кто",
    )

    class Meta:
        verbose_name = "Запись активности лида"
        verbose_name_plural = "Активность лида"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.lead} — {self.summary[:60]}"

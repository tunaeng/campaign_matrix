from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.db.models.signals import post_save
from django.dispatch import receiver


class Funnel(models.Model):
    name = models.CharField(max_length=300, verbose_name="Название воронки")
    description = models.TextField(blank=True, verbose_name="Описание")
    is_active = models.BooleanField(default=True, verbose_name="Активна")
    tags = models.ManyToManyField(
        "organizations.OrganizationTag",
        blank=True,
        related_name="funnels",
        verbose_name="Теги",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Воронка"
        verbose_name_plural = "Воронки"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def ensure_rejection_stage(self):
        if not self.stages.filter(is_rejection=True).exists():
            max_order = self.stages.order_by("-order").values_list("order", flat=True).first() or 0
            FunnelStage.objects.create(
                funnel=self,
                name="Отказ",
                order=max_order + 100,
                deadline_days=0,
                is_rejection=True,
            )


class FunnelStage(models.Model):
    class ResponsibleRole(models.TextChoices):
        MANAGER = "manager", "Менеджер"
        PRIMARY_CONTACT_SPECIALIST = "primary_contact_specialist", "Специалист по первичному контакту"

    class SelectionMode(models.TextChoices):
        REGIONS = "regions", "Регионы"

    funnel = models.ForeignKey(
        Funnel,
        on_delete=models.CASCADE,
        related_name="stages",
        verbose_name="Воронка",
    )
    name = models.CharField(max_length=300, verbose_name="Название стадии")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок")
    deadline_days = models.PositiveIntegerField(
        default=0,
        verbose_name="Дедлайн (раб. дней от старта)",
        help_text="Количество рабочих дней от даты старта очереди",
    )
    is_rejection = models.BooleanField(
        default=False,
        verbose_name="Стадия отказа",
        help_text="Специальная стадия, на которую можно перейти из любой другой",
    )
    responsible_role = models.CharField(
        max_length=40,
        choices=ResponsibleRole.choices,
        default=ResponsibleRole.MANAGER,
        verbose_name="Роль этапа",
        help_text="Роль, которая по умолчанию отвечает за выполнение этапа",
    )
    is_collect_stage = models.BooleanField(
        default=False,
        verbose_name="Стадия сбора и добавления лидов",
        help_text="Опциональная нулевая стадия предварительного сбора лидов",
    )
    selection_mode = models.CharField(
        max_length=20,
        choices=SelectionMode.choices,
        blank=True,
        default="",
        verbose_name="Режим отбора",
    )
    search_task = models.TextField(
        blank=True,
        default="",
        verbose_name="Задание на поиск",
        help_text="Краткое описание типа организаций и контактов для первичного поиска",
    )
    primary_contact_specialist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="primary_contact_funnel_stages",
        verbose_name="Специалист по умолчанию",
    )

    class Meta:
        verbose_name = "Стадия воронки"
        verbose_name_plural = "Стадии воронки"
        ordering = ["order"]
        unique_together = ["funnel", "order"]
        constraints = [
            models.UniqueConstraint(
                fields=["funnel"],
                condition=Q(is_collect_stage=True),
                name="funnel_single_collect_stage",
            ),
        ]

    def __str__(self):
        return f"{self.funnel.name} — {self.name}"

    def clean(self):
        errors = {}
        if self.is_rejection and self.is_collect_stage:
            errors["is_collect_stage"] = "Стадия отказа не может быть стадией сбора лидов."
        if self.is_collect_stage and self.selection_mode != self.SelectionMode.REGIONS:
            errors["selection_mode"] = "Для стадии сбора лидов доступен только отбор по регионам."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.is_collect_stage and not self.selection_mode:
            self.selection_mode = self.SelectionMode.REGIONS
        if not self.is_collect_stage:
            self.selection_mode = ""
            self.search_task = ""
        super().save(*args, **kwargs)


class StageChecklistItem(models.Model):
    class ConfirmationType(models.TextChoices):
        NONE = "none", "Без подтверждения"
        TEXT = "text", "Текст"
        FILE = "file", "Файл(ы)"
        SELECT = "select", "Выбор из списка"
        CONTACT = "contact", "Контакт"

    class CommunicationStep(models.TextChoices):
        NONE = "", "Без шага"
        EMAIL_PREPARED = "email_prepared", "Письмо подготовлено"
        EMAIL_SENT = "email_sent", "Письмо отправлено"
        RESPONSE_RECEIVED = "response_received", "Ответ получен"
        RESULT_RECORDED = "result_recorded", "Результат зафиксирован"

    stage = models.ForeignKey(
        FunnelStage,
        on_delete=models.CASCADE,
        related_name="checklist_items",
        verbose_name="Стадия",
    )
    text = models.CharField(max_length=500, verbose_name="Текст пункта")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок")
    confirmation_types = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Типы подтверждения",
        help_text='Список кодов: text, file, select, contact. Пустой список — без подтверждения.',
    )
    primary_contact_specialist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="primary_contact_checklist_items",
        verbose_name="Специалист по первичному контакту",
    )
    communication_step = models.CharField(
        max_length=40,
        choices=CommunicationStep.choices,
        blank=True,
        default="",
        verbose_name="Шаг коммуникации",
    )

    class Meta:
        verbose_name = "Пункт чек-листа"
        verbose_name_plural = "Пункты чек-листа"
        ordering = ["order"]

    def __str__(self):
        return self.text

    def get_confirmation_types_display_list(self):
        labels = dict(self.ConfirmationType.choices)
        return [labels.get(code, code) for code in (self.confirmation_types or [])]


class ChecklistItemOption(models.Model):
    checklist_item = models.ForeignKey(
        StageChecklistItem,
        on_delete=models.CASCADE,
        related_name="options",
        verbose_name="Пункт чек-листа",
    )
    value = models.CharField(max_length=300, verbose_name="Значение")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок")

    class Meta:
        verbose_name = "Вариант выбора"
        verbose_name_plural = "Варианты выбора"
        ordering = ["order"]

    def __str__(self):
        return self.value


class SubfunnelTemplate(models.Model):
    name = models.CharField(max_length=300, verbose_name="Название подворонки")
    slug = models.SlugField(max_length=120, unique=True, verbose_name="Slug")
    description = models.TextField(blank=True, default="", verbose_name="Описание")
    owner_role = models.ForeignKey(
        "accounts.RoleDefinition",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_subfunnel_templates",
        verbose_name="Базовая роль-владелец",
    )
    is_active = models.BooleanField(default=True, verbose_name="Активна")
    auto_create_on_collect_import = models.BooleanField(
        default=True,
        verbose_name="Создавать карточки при добавлении/импорте организаций и контактов",
    )
    advance_lead_on_task_stage_forward = models.BooleanField(
        default=False,
        verbose_name='Переводить лид на следующую стадию при переводе карточки задачи вперед',
    )
    version = models.PositiveIntegerField(default=1, verbose_name="Версия шаблона")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Шаблон подворонки"
        verbose_name_plural = "Шаблоны подворонок"
        ordering = ["name"]

    def __str__(self):
        return self.name


class TaskTemplateStage(models.Model):
    class TaskStatus(models.TextChoices):
        BACKLOG = "backlog", "Бэклог"
        IN_PROGRESS = "in_progress", "В работе"
        PAUSED = "paused", "Пауза"
        REJECTED = "rejected", "Отказ"
        DONE = "done", "Готово"

    template = models.ForeignKey(
        SubfunnelTemplate,
        on_delete=models.CASCADE,
        related_name="stages",
        verbose_name="Шаблон задачи",
    )
    name = models.CharField(max_length=200, verbose_name="Название этапа")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок")
    is_work_stage = models.BooleanField(default=True, verbose_name="Этап в работе")
    is_active = models.BooleanField(default=True, verbose_name="Активен")
    task_status = models.CharField(
        max_length=30,
        choices=TaskStatus.choices,
        default=TaskStatus.IN_PROGRESS,
        verbose_name="Статус задачи для этапа",
    )
    is_terminal = models.BooleanField(default=False, verbose_name="Финальный этап")
    sla_days = models.PositiveIntegerField(default=0, verbose_name="SLA (дней)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Этап шаблона задачи"
        verbose_name_plural = "Этапы шаблона задачи"
        ordering = ["order", "id"]
        unique_together = ["template", "order"]

    def __str__(self):
        return f"{self.template.name} — {self.name}"


class SubfunnelTemplateItem(models.Model):
    class ExecutionType(models.TextChoices):
        STAGE = "stage", "Отдельная стадия"
        CHECKLIST_ITEM = "checklist_item", "Пункт чек-листа"
        STAGE_RANGE_CHECKLIST = "stage_range_checklist", "Чек-лист диапазона стадий"

    template = models.ForeignKey(
        SubfunnelTemplate,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Шаблон подворонки",
    )
    title = models.CharField(max_length=300, verbose_name="Название пункта")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок")
    execution_type = models.CharField(
        max_length=40,
        choices=ExecutionType.choices,
        default=ExecutionType.CHECKLIST_ITEM,
        verbose_name="Тип исполнения",
    )
    stage = models.ForeignKey(
        TaskTemplateStage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="items",
        verbose_name="Этап задачи",
    )
    default_role = models.ForeignKey(
        "accounts.RoleDefinition",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_subfunnel_template_items",
        verbose_name="Роль по умолчанию",
    )
    default_specialist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_subfunnel_template_items",
        verbose_name="Специалист по умолчанию",
    )

    class Meta:
        verbose_name = "Пункт шаблона подворонки"
        verbose_name_plural = "Пункты шаблона подворонки"
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.template.name}: {self.title}"


class SubfunnelTemplateBinding(models.Model):
    class BindingType(models.TextChoices):
        STAGE = "stage", "К стадии"
        CHECKLIST_ITEM = "checklist_item", "К пункту чек-листа"
        STAGE_RANGE_CHECKLIST = "stage_range_checklist", "К диапазону стадий"

    funnel = models.ForeignKey(
        Funnel,
        on_delete=models.CASCADE,
        related_name="subfunnel_bindings",
        verbose_name="Основная воронка",
    )
    template = models.ForeignKey(
        SubfunnelTemplate,
        on_delete=models.CASCADE,
        related_name="bindings",
        verbose_name="Шаблон подворонки",
    )
    binding_type = models.CharField(
        max_length=40,
        choices=BindingType.choices,
        default=BindingType.CHECKLIST_ITEM,
        verbose_name="Тип привязки",
    )
    target_stage = models.ForeignKey(
        FunnelStage,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subfunnel_bindings_as_stage",
        verbose_name="Целевая стадия",
    )
    target_checklist_item = models.ForeignKey(
        StageChecklistItem,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subfunnel_bindings_as_checklist_item",
        verbose_name="Целевой пункт чек-листа",
    )
    from_stage = models.ForeignKey(
        FunnelStage,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subfunnel_bindings_as_from_stage",
        verbose_name="Стадия начала диапазона",
    )
    to_stage = models.ForeignKey(
        FunnelStage,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subfunnel_bindings_as_to_stage",
        verbose_name="Стадия окончания диапазона",
    )
    role = models.ForeignKey(
        "accounts.RoleDefinition",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subfunnel_bindings",
        verbose_name="Роль",
    )
    default_specialist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subfunnel_bindings_default_specialist",
        verbose_name="Специалист по умолчанию",
    )
    is_active = models.BooleanField(default=True, verbose_name="Активна")
    advance_lead_on_task_stage_forward = models.BooleanField(
        default=False,
        verbose_name='Автопереводить лид вперед при переводе карточки задачи (только для привязки "к стадии")',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Привязка шаблона подворонки"
        verbose_name_plural = "Привязки шаблонов подворонок"
        ordering = ["funnel_id", "id"]

    def clean(self):
        errors = {}
        if self.binding_type in {self.BindingType.STAGE, self.BindingType.CHECKLIST_ITEM}:
            if not self.target_stage:
                errors["target_stage"] = "Нужно указать целевую стадию."
        if self.binding_type == self.BindingType.CHECKLIST_ITEM and not self.target_checklist_item:
            errors["target_checklist_item"] = "Нужно указать целевой пункт чек-листа."
        if self.binding_type == self.BindingType.STAGE_RANGE_CHECKLIST:
            if not self.from_stage or not self.to_stage:
                errors["from_stage"] = "Нужно указать диапазон стадий."
            elif self.from_stage.order > self.to_stage.order:
                errors["to_stage"] = "Стадия окончания не может быть раньше стадии начала."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.funnel} → {self.template}"


@receiver(post_save, sender=Funnel)
def auto_create_rejection_stage(sender, instance, created, **kwargs):
    if created:
        instance.ensure_rejection_stage()

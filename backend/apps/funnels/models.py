from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Funnel(models.Model):
    name = models.CharField(max_length=300, verbose_name="Название воронки")
    description = models.TextField(blank=True, verbose_name="Описание")
    is_active = models.BooleanField(default=True, verbose_name="Активна")
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

    class Meta:
        verbose_name = "Стадия воронки"
        verbose_name_plural = "Стадии воронки"
        ordering = ["order"]
        unique_together = ["funnel", "order"]

    def __str__(self):
        return f"{self.funnel.name} — {self.name}"


class StageChecklistItem(models.Model):
    class ConfirmationType(models.TextChoices):
        NONE = "none", "Без подтверждения"
        TEXT = "text", "Текст"
        FILE = "file", "Файл(ы)"
        SELECT = "select", "Выбор из списка"
        CONTACT = "contact", "Контакт"

    stage = models.ForeignKey(
        FunnelStage,
        on_delete=models.CASCADE,
        related_name="checklist_items",
        verbose_name="Стадия",
    )
    text = models.CharField(max_length=500, verbose_name="Текст пункта")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок")
    confirmation_type = models.CharField(
        max_length=20,
        choices=ConfirmationType.choices,
        default=ConfirmationType.NONE,
        verbose_name="Тип подтверждения",
    )

    class Meta:
        verbose_name = "Пункт чек-листа"
        verbose_name_plural = "Пункты чек-листа"
        ordering = ["order"]

    def __str__(self):
        return self.text


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


@receiver(post_save, sender=Funnel)
def auto_create_rejection_stage(sender, instance, created, **kwargs):
    if created:
        instance.ensure_rejection_stage()

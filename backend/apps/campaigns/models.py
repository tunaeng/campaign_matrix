from django.conf import settings
from django.db import models


class Campaign(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        ACTIVE = "active", "В работе"
        PAUSED = "paused", "Приостановлена"
        COMPLETED = "completed", "Завершена"

    name = models.CharField(max_length=500, verbose_name="Название кампании")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="Статус",
    )
    federal_operator = models.ForeignKey(
        "reference.FederalOperator",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaigns",
        verbose_name="Федеральный оператор",
    )
    hypothesis = models.TextField(
        blank=True, verbose_name="Гипотеза"
    )
    hypothesis_result = models.TextField(
        blank=True, verbose_name="Результат проверки гипотезы"
    )
    forecast_demand = models.IntegerField(
        null=True, blank=True, verbose_name="Прогноз потребности (чел.)"
    )
    deadline = models.DateField(
        null=True, blank=True, verbose_name="Дедлайн"
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
        return (
            self.organizations.aggregate(
                total=models.Sum("demand_count")
            )["total"]
            or 0
        )

    @property
    def organizations_count(self):
        return self.organizations.count()


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

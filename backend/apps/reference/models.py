from django.db import models


class FederalDistrict(models.Model):
    name = models.CharField(max_length=200, verbose_name="Название")
    code = models.CharField(max_length=10, unique=True, verbose_name="Код")
    short_name = models.CharField(
        max_length=10, blank=True, verbose_name="Сокращение"
    )

    class Meta:
        verbose_name = "Федеральный округ"
        verbose_name_plural = "Федеральные округа"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Region(models.Model):
    name = models.CharField(max_length=200, verbose_name="Название")
    code = models.CharField(max_length=10, blank=True, verbose_name="Код")
    federal_district = models.ForeignKey(
        FederalDistrict,
        on_delete=models.CASCADE,
        related_name="regions",
        verbose_name="Федеральный округ",
    )

    class Meta:
        verbose_name = "Регион"
        verbose_name_plural = "Регионы"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Profession(models.Model):
    number = models.IntegerField(verbose_name="Номер в перечне")
    name = models.CharField(max_length=500, verbose_name="Наименование профессии")

    class Meta:
        verbose_name = "Профессия"
        verbose_name_plural = "Профессии"
        ordering = ["number"]

    def __str__(self):
        return f"{self.number}. {self.name}"


class ProfessionDemandStatus(models.Model):
    profession = models.ForeignKey(
        Profession,
        on_delete=models.CASCADE,
        related_name="demand_statuses",
        verbose_name="Профессия",
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.CASCADE,
        related_name="demand_statuses",
        verbose_name="Регион",
    )
    is_demanded = models.BooleanField(
        default=False, verbose_name="Востребована"
    )
    year = models.IntegerField(default=2026, verbose_name="Год")

    class Meta:
        verbose_name = "Востребованность профессии"
        verbose_name_plural = "Востребованность профессий"
        unique_together = ["profession", "region", "year"]

    def __str__(self):
        status = "да" if self.is_demanded else "нет"
        return f"{self.profession.name} — {self.region.name}: {status}"


class ProfessionApprovalStatus(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "pending", "Ожидает"
        IN_PROGRESS = "in_progress", "В проработке"
        PRELIMINARY_APPROVED = "preliminary_approved", "Предварительно одобрено"
        APPROVED = "approved", "Одобрено (по факту потока)"
        REJECTED = "rejected", "Отказано"
        UNLIKELY = "unlikely", "Маловероятно"

    profession = models.ForeignKey(
        Profession,
        on_delete=models.CASCADE,
        related_name="approval_statuses",
        verbose_name="Профессия",
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.CASCADE,
        related_name="approval_statuses",
        verbose_name="Регион",
    )
    year = models.IntegerField(default=2026, verbose_name="Год")
    approval_status = models.CharField(
        max_length=30,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
        verbose_name="Статус одобрения",
    )
    approved_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Дата одобрения",
    )
    notes = models.TextField(blank=True, verbose_name="Примечания")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Статус одобрения профессии"
        verbose_name_plural = "Статусы одобрения профессий"
        unique_together = ["profession", "region", "year"]

    def __str__(self):
        return f"{self.profession.name} — {self.region.name}: {self.get_approval_status_display()}"


class Program(models.Model):
    name = models.CharField(max_length=500, verbose_name="Наименование программы")
    profession = models.ForeignKey(
        Profession,
        on_delete=models.CASCADE,
        related_name="programs",
        verbose_name="Профессия",
    )
    description = models.TextField(blank=True, verbose_name="Описание")
    hours = models.IntegerField(null=True, blank=True, verbose_name="Часов обучения")
    is_active = models.BooleanField(default=True, verbose_name="Активна")

    class Meta:
        verbose_name = "Программа обучения"
        verbose_name_plural = "Программы обучения"
        ordering = ["name"]

    def __str__(self):
        return self.name


class FederalOperator(models.Model):
    name = models.CharField(max_length=300, verbose_name="Наименование")
    code = models.CharField(max_length=50, unique=True, verbose_name="Код")
    description = models.TextField(blank=True, verbose_name="Описание")

    class Meta:
        verbose_name = "Федеральный оператор"
        verbose_name_plural = "Федеральные операторы"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Contract(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Проект"
        ACTIVE = "active", "Действующий"
        COMPLETED = "completed", "Завершён"

    federal_operator = models.ForeignKey(
        FederalOperator,
        on_delete=models.CASCADE,
        related_name="contracts",
        verbose_name="Федеральный оператор",
    )
    number = models.CharField(max_length=100, blank=True, verbose_name="Номер договора")
    year = models.IntegerField(verbose_name="Год")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="Статус",
    )
    notes = models.TextField(blank=True, verbose_name="Примечания")

    class Meta:
        verbose_name = "Договор"
        verbose_name_plural = "Договоры"
        ordering = ["-year", "federal_operator"]

    def __str__(self):
        return f"Договор {self.number or '—'} ({self.federal_operator}, {self.year})"


class ContractProgram(models.Model):
    class Status(models.TextChoices):
        DRAFT_APPENDIX = "draft_appendix", "В проекте приложения"
        IN_APPENDIX = "in_appendix", "В приложении"
        APPROVED = "approved", "Утверждена"

    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name="programs",
        verbose_name="Договор",
    )
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name="contract_entries",
        verbose_name="Программа",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT_APPENDIX,
        verbose_name="Статус в договоре",
    )

    class Meta:
        verbose_name = "Программа в договоре"
        verbose_name_plural = "Программы в договорах"
        unique_together = ["contract", "program"]

    def __str__(self):
        return f"{self.program.name} — {self.contract}"


class Quota(models.Model):
    federal_operator = models.ForeignKey(
        FederalOperator,
        on_delete=models.CASCADE,
        related_name="quotas",
        verbose_name="Федеральный оператор",
    )
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name="quotas",
        null=True,
        blank=True,
        verbose_name="Программа",
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.CASCADE,
        related_name="quotas",
        null=True,
        blank=True,
        verbose_name="Регион",
    )
    year = models.IntegerField(default=2026, verbose_name="Год")
    total = models.IntegerField(default=0, verbose_name="Всего квота")
    used = models.IntegerField(default=0, verbose_name="Использовано")

    class Meta:
        verbose_name = "Квота"
        verbose_name_plural = "Квоты"

    def __str__(self):
        parts = [str(self.federal_operator)]
        if self.program:
            parts.append(self.program.name)
        if self.region:
            parts.append(self.region.name)
        return f"Квота: {' / '.join(parts)} ({self.used}/{self.total})"

    @property
    def available(self):
        return self.total - self.used

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
    federal_operator = models.ForeignKey(
        "FederalOperator",
        on_delete=models.CASCADE,
        related_name="demand_statuses",
        verbose_name="Федеральный оператор",
    )
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
    year = models.IntegerField(default=2026, verbose_name="Год", db_index=True)

    class Meta:
        verbose_name = "Востребованность профессии"
        verbose_name_plural = "Востребованность профессий"
        unique_together = ["federal_operator", "profession", "region", "year"]

    def save(self, *args, **kwargs):
        is_create = self.pk is None
        previous_is_demanded = None
        if not is_create:
            previous_is_demanded = (
                ProfessionDemandStatus.objects.filter(pk=self.pk)
                .values_list("is_demanded", flat=True)
                .first()
            )

        super().save(*args, **kwargs)

        if is_create or previous_is_demanded != self.is_demanded:
            ProfessionDemandStatusHistory.objects.create(
                demand_status=self,
                federal_operator=self.federal_operator,
                profession=self.profession,
                region=self.region,
                year=self.year,
                previous_is_demanded=previous_is_demanded,
                new_is_demanded=self.is_demanded,
            )

    def __str__(self):
        status = "да" if self.is_demanded else "нет"
        return f"{self.profession.name} — {self.region.name}: {status}"


class ProfessionDemandStatusHistory(models.Model):
    demand_status = models.ForeignKey(
        ProfessionDemandStatus,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_entries",
        verbose_name="Запись востребованности",
    )
    federal_operator = models.ForeignKey(
        "FederalOperator",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="demand_history_entries",
        verbose_name="Федеральный оператор",
    )
    profession = models.ForeignKey(
        Profession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="demand_history_entries",
        verbose_name="Профессия",
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="demand_history_entries",
        verbose_name="Регион",
    )
    year = models.IntegerField(default=2026, verbose_name="Год", db_index=True)
    previous_is_demanded = models.BooleanField(
        null=True, blank=True, verbose_name="Было востребовано"
    )
    new_is_demanded = models.BooleanField(verbose_name="Стало востребовано")
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name="Изменено")

    class Meta:
        verbose_name = "История востребованности"
        verbose_name_plural = "История востребованности"
        ordering = ["-changed_at"]

    def __str__(self):
        prev = "—" if self.previous_is_demanded is None else ("да" if self.previous_is_demanded else "нет")
        new = "да" if self.new_is_demanded else "нет"
        return f"{self.profession} / {self.region}: {prev} -> {new}"


class DemandImport(models.Model):
    federal_operator = models.ForeignKey(
        "FederalOperator",
        on_delete=models.CASCADE,
        related_name="demand_imports",
        verbose_name="Федеральный оператор",
    )
    year = models.IntegerField(verbose_name="Год")
    imported_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата импорта")
    imported_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="demand_imports",
        verbose_name="Импортировал",
    )
    snapshot_count = models.PositiveIntegerField(
        default=0, verbose_name="Записей в снимке"
    )

    class Meta:
        verbose_name = "Импорт востребованности"
        verbose_name_plural = "Импорты востребованности"
        ordering = ["-imported_at"]

    def __str__(self):
        return (
            f"Импорт {self.federal_operator} / {self.year} "
            f"от {self.imported_at:%d.%m.%Y %H:%M}"
        )


class DemandImportSnapshot(models.Model):
    demand_import = models.ForeignKey(
        DemandImport,
        on_delete=models.CASCADE,
        related_name="snapshots",
        verbose_name="Импорт",
    )
    profession = models.ForeignKey(
        Profession,
        on_delete=models.CASCADE,
        related_name="+",
        verbose_name="Профессия",
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.CASCADE,
        related_name="+",
        verbose_name="Регион",
    )
    is_demanded = models.BooleanField(verbose_name="Востребована")

    class Meta:
        verbose_name = "Снимок востребованности"
        verbose_name_plural = "Снимки востребованности"
        unique_together = ["demand_import", "profession", "region"]

    def __str__(self):
        status = "да" if self.is_demanded else "нет"
        return f"{self.profession} / {self.region}: {status}"


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
    year = models.IntegerField(default=2026, verbose_name="Год", db_index=True)
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
    short_name = models.CharField(
        max_length=150, blank=True, verbose_name="Сокращённое название"
    )
    description = models.TextField(blank=True, verbose_name="Описание")

    class Meta:
        verbose_name = "Федеральный оператор"
        verbose_name_plural = "Федеральные операторы"
        ordering = ["name"]

    @property
    def display_name(self):
        return (self.short_name or self.name).strip() or self.name

    def __str__(self):
        return self.display_name


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

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("organizations", "0013_phone_extension_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="ImportBatch",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "entity_type",
                    models.CharField(
                        choices=[("organizations", "Организации"), ("contacts", "Контакты")],
                        max_length=20,
                        verbose_name="Тип сущности",
                    ),
                ),
                ("file_name", models.CharField(max_length=255, verbose_name="Имя файла")),
                ("uploaded_at", models.DateTimeField(auto_now_add=True, verbose_name="Дата загрузки")),
                ("created_count", models.PositiveIntegerField(default=0, verbose_name="Создано")),
                ("updated_count", models.PositiveIntegerField(default=0, verbose_name="Обновлено")),
                ("skipped_count", models.PositiveIntegerField(default=0, verbose_name="Пропущено")),
                ("total_rows", models.PositiveIntegerField(default=0, verbose_name="Строк в файле")),
                (
                    "status",
                    models.CharField(
                        choices=[("completed", "Завершён"), ("rolled_back", "Откат выполнен")],
                        default="completed",
                        max_length=20,
                        verbose_name="Статус",
                    ),
                ),
                ("rolled_back_at", models.DateTimeField(blank=True, null=True, verbose_name="Дата отката")),
                (
                    "rolled_back_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="rolled_back_import_batches",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Откатил",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="import_batches",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Загрузил",
                    ),
                ),
            ],
            options={
                "verbose_name": "Пакет импорта",
                "verbose_name_plural": "Пакеты импорта",
                "ordering": ["-uploaded_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="ImportBatchRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "action",
                    models.CharField(
                        choices=[("created", "Создано"), ("updated", "Обновлено")],
                        max_length=20,
                        verbose_name="Действие",
                    ),
                ),
                ("snapshot", models.JSONField(blank=True, default=dict, verbose_name="Снимок до изменения")),
                (
                    "batch",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="records",
                        to="organizations.importbatch",
                        verbose_name="Пакет импорта",
                    ),
                ),
                (
                    "contact",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="import_batch_records",
                        to="organizations.contact",
                        verbose_name="Контакт",
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="import_batch_records",
                        to="organizations.organization",
                        verbose_name="Организация",
                    ),
                ),
            ],
            options={
                "verbose_name": "Запись пакета импорта",
                "verbose_name_plural": "Записи пакетов импорта",
                "ordering": ["-id"],
            },
        ),
        migrations.AddIndex(
            model_name="importbatchrecord",
            index=models.Index(fields=["batch", "action"], name="organizatio_batch_i_6f0b0d_idx"),
        ),
    ]

# Generated manually

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("campaigns", "0003_leadchecklistvalue_contact_leadinteraction_contact"),
    ]

    operations = [
        migrations.CreateModel(
            name="LeadActivityLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("stage", "Стадия"),
                            ("checklist", "Чек-лист"),
                        ],
                        max_length=20,
                        verbose_name="Тип",
                    ),
                ),
                ("summary", models.CharField(max_length=500, verbose_name="Описание")),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="Когда"),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="lead_activity_logs",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Кто",
                    ),
                ),
                (
                    "lead",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activity_logs",
                        to="campaigns.lead",
                        verbose_name="Лид",
                    ),
                ),
            ],
            options={
                "verbose_name": "Запись активности лида",
                "verbose_name_plural": "Активность лида",
                "ordering": ["-created_at"],
            },
        ),
    ]

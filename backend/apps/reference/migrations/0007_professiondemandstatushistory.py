from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("reference", "0006_add_year_indexes"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProfessionDemandStatusHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("year", models.IntegerField(db_index=True, default=2026, verbose_name="Год")),
                ("previous_is_demanded", models.BooleanField(blank=True, null=True, verbose_name="Было востребовано")),
                ("new_is_demanded", models.BooleanField(verbose_name="Стало востребовано")),
                ("changed_at", models.DateTimeField(auto_now_add=True, verbose_name="Изменено")),
                (
                    "demand_status",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="history_entries",
                        to="reference.professiondemandstatus",
                        verbose_name="Запись востребованности",
                    ),
                ),
                (
                    "federal_operator",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="demand_history_entries",
                        to="reference.federaloperator",
                        verbose_name="Федеральный оператор",
                    ),
                ),
                (
                    "profession",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="demand_history_entries",
                        to="reference.profession",
                        verbose_name="Профессия",
                    ),
                ),
                (
                    "region",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="demand_history_entries",
                        to="reference.region",
                        verbose_name="Регион",
                    ),
                ),
            ],
            options={
                "verbose_name": "История востребованности",
                "verbose_name_plural": "История востребованности",
                "ordering": ["-changed_at"],
            },
        ),
    ]


from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="RoleDefinition",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.SlugField(max_length=80, unique=True, verbose_name="Код")),
                ("name", models.CharField(max_length=200, verbose_name="Название")),
                ("description", models.TextField(blank=True, default="", verbose_name="Описание")),
                (
                    "scope_type",
                    models.CharField(
                        choices=[
                            ("global", "Глобальная"),
                            ("campaign", "Кампания"),
                            ("funnel", "Воронка"),
                            ("subfunnel", "Подворонка"),
                        ],
                        default="global",
                        max_length=20,
                        verbose_name="Область применения",
                    ),
                ),
                ("is_active", models.BooleanField(default=True, verbose_name="Активна")),
                ("is_system", models.BooleanField(default=False, verbose_name="Системная")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Роль (справочник)",
                "verbose_name_plural": "Роли (справочник)",
                "ordering": ["name", "id"],
            },
        ),
    ]

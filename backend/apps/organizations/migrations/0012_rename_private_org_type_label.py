# Подпись типа «Частная» → «Коммерческая» (код private без изменений)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0011_organization_branch_nullable_inn"),
    ]

    operations = [
        migrations.AlterField(
            model_name="organization",
            name="org_type",
            field=models.CharField(
                choices=[
                    ("roiv", "РОИВ"),
                    ("federal", "Федеральная"),
                    ("municipal", "Муниципальная"),
                    ("private", "Коммерческая"),
                    ("company_branch", "Подразделение компании (без ИНН)"),
                    ("other", "Другое"),
                ],
                default="other",
                max_length=20,
                verbose_name="Тип организации",
            ),
        ),
    ]

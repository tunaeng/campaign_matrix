# Generated manually: подразделения без собственного ИНН

from django.db import migrations, models
from django.db.models import Q


def forwards_empty_inn_to_null(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    Organization.objects.filter(inn="").update(inn=None)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0010_default_acting_organization"),
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
                    ("private", "Частная"),
                    ("company_branch", "Подразделение компании (без ИНН)"),
                    ("other", "Другое"),
                ],
                default="other",
                max_length=20,
                verbose_name="Тип организации",
            ),
        ),
        migrations.AlterField(
            model_name="organization",
            name="inn",
            field=models.CharField(
                blank=True,
                help_text="Для подразделений без собственного ИНН оставьте пустым и укажите головную организацию.",
                max_length=12,
                null=True,
                verbose_name="ИНН",
            ),
        ),
        migrations.RunPython(forwards_empty_inn_to_null, noop_reverse),
        migrations.AddConstraint(
            model_name="organization",
            constraint=models.UniqueConstraint(
                condition=Q(inn__isnull=False) & ~Q(inn=""),
                fields=("inn",),
                name="organization_inn_unique_when_set",
            ),
        ),
    ]

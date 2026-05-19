# Generated manually for org_type taxonomy change

from django.db import migrations, models


OLD_TO_NEW = {
    "ministry": "federal",
    "enterprise": "private",
    "education": "other",
    "healthcare": "other",
    "municipal": "municipal",
    "other": "other",
}


def forwards_remap_org_types(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    for old, new in OLD_TO_NEW.items():
        if old != new:
            Organization.objects.filter(org_type=old).update(org_type=new)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0008_entity_field_change_audit"),
    ]

    operations = [
        migrations.RunPython(forwards_remap_org_types, noop_reverse),
        migrations.AlterField(
            model_name="organization",
            name="org_type",
            field=models.CharField(
                choices=[
                    ("roiv", "РОИВ"),
                    ("federal", "Федеральная"),
                    ("municipal", "Муниципальная"),
                    ("private", "Частная"),
                    ("other", "Другое"),
                ],
                default="other",
                max_length=20,
                verbose_name="Тип организации",
            ),
        ),
    ]

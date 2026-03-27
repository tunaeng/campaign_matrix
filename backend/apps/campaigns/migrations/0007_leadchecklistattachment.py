import os

from django.core.files.base import ContentFile
from django.db import migrations, models
import django.db.models.deletion


def copy_legacy_files_to_attachments(apps, schema_editor):
    LeadChecklistValue = apps.get_model("campaigns", "LeadChecklistValue")
    LeadChecklistAttachment = apps.get_model("campaigns", "LeadChecklistAttachment")
    for v in LeadChecklistValue.objects.exclude(file_value=""):
        try:
            name = os.path.basename(v.file_value.name)
            with v.file_value.open("rb") as src:
                content = src.read()
        except Exception:
            continue
        att = LeadChecklistAttachment(checklist_value=v, order=0)
        att.file.save(name, ContentFile(content), save=True)


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0006_lead_demand_quota_split"),
    ]

    operations = [
        migrations.CreateModel(
            name="LeadChecklistAttachment",
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
                    "file",
                    models.FileField(upload_to="lead_files/", verbose_name="Файл"),
                ),
                (
                    "order",
                    models.PositiveIntegerField(default=0, verbose_name="Порядок"),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "checklist_value",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attachments",
                        to="campaigns.leadchecklistvalue",
                        verbose_name="Значение чек-листа",
                    ),
                ),
            ],
            options={
                "verbose_name": "Вложение чек-листа",
                "verbose_name_plural": "Вложения чек-листа",
                "ordering": ["order", "id"],
            },
        ),
        migrations.RunPython(copy_legacy_files_to_attachments, migrations.RunPython.noop),
    ]

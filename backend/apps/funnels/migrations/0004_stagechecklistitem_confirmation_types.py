from django.db import migrations, models


def forwards_copy_confirmation(apps, schema_editor):
    StageChecklistItem = apps.get_model("funnels", "StageChecklistItem")
    for row in StageChecklistItem.objects.all():
        old = row.confirmation_type
        if old in (None, "", "none"):
            row.confirmation_types = []
        else:
            row.confirmation_types = [old]
        row.save(update_fields=["confirmation_types"])


def backwards_restore_confirmation(apps, schema_editor):
    StageChecklistItem = apps.get_model("funnels", "StageChecklistItem")
    for row in StageChecklistItem.objects.all():
        types = row.confirmation_types or []
        row.confirmation_type = types[0] if types else "none"
        row.save(update_fields=["confirmation_type"])


class Migration(migrations.Migration):

    dependencies = [
        ("funnels", "0003_add_rejection_stage_to_existing_funnels"),
    ]

    operations = [
        migrations.AddField(
            model_name="stagechecklistitem",
            name="confirmation_types",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Список кодов: text, file, select, contact. Пустой список — без подтверждения.",
                verbose_name="Типы подтверждения",
            ),
        ),
        migrations.RunPython(forwards_copy_confirmation, backwards_restore_confirmation),
        migrations.RemoveField(
            model_name="stagechecklistitem",
            name="confirmation_type",
        ),
    ]

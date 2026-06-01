from django.db import migrations, models


def fill_task_stage_status(apps, schema_editor):
    TaskTemplateStage = apps.get_model("funnels", "TaskTemplateStage")
    for stage in TaskTemplateStage.objects.all():
        name = (stage.name or "").lower()
        if stage.is_terminal:
            stage.task_status = "done"
        elif "отказ" in name:
            stage.task_status = "rejected"
        elif "пауза" in name:
            stage.task_status = "paused"
        elif "бэклог" in name or "беклог" in name:
            stage.task_status = "backlog"
        else:
            stage.task_status = "in_progress"
        stage.save(update_fields=["task_status"])


class Migration(migrations.Migration):

    dependencies = [
        ("funnels", "0015_canonical_task_funnels"),
    ]

    operations = [
        migrations.AddField(
            model_name="tasktemplatestage",
            name="task_status",
            field=models.CharField(
                choices=[
                    ("backlog", "Бэклог"),
                    ("in_progress", "В работе"),
                    ("paused", "Пауза"),
                    ("rejected", "Отказ"),
                    ("done", "Готово"),
                ],
                default="in_progress",
                max_length=30,
                verbose_name="Статус задачи для этапа",
            ),
        ),
        migrations.RunPython(fill_task_stage_status, migrations.RunPython.noop),
    ]

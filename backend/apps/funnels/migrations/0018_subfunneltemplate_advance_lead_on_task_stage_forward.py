from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("funnels", "0017_subfunneltemplate_auto_create_on_collect_import"),
    ]

    operations = [
        migrations.AddField(
            model_name="subfunneltemplate",
            name="advance_lead_on_task_stage_forward",
            field=models.BooleanField(
                default=False,
                verbose_name="Переводить лид на следующую стадию при переводе карточки задачи вперед",
            ),
        ),
    ]

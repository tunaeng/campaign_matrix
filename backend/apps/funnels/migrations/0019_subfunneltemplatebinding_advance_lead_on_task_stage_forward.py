from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("funnels", "0018_subfunneltemplate_advance_lead_on_task_stage_forward"),
    ]

    operations = [
        migrations.AddField(
            model_name="subfunneltemplatebinding",
            name="advance_lead_on_task_stage_forward",
            field=models.BooleanField(
                default=False,
                verbose_name='Автопереводить лид вперед при переводе карточки задачи (только для привязки "к стадии")',
            ),
        ),
    ]

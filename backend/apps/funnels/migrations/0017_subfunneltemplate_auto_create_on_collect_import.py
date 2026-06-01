from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("funnels", "0016_tasktemplatestage_task_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="subfunneltemplate",
            name="auto_create_on_collect_import",
            field=models.BooleanField(
                default=True,
                verbose_name="Создавать карточки при добавлении/импорте организаций и контактов",
            ),
        ),
    ]

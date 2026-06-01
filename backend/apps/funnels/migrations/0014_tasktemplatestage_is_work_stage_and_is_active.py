from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("funnels", "0013_subfunneltemplate_subfunneltemplatebinding_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="tasktemplatestage",
            name="is_active",
            field=models.BooleanField(default=True, verbose_name="Активен"),
        ),
        migrations.AddField(
            model_name="tasktemplatestage",
            name="is_work_stage",
            field=models.BooleanField(default=True, verbose_name="Этап в работе"),
        ),
    ]

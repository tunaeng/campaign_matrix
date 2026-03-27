# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0005_lead_primary_contact"),
    ]

    operations = [
        migrations.AddField(
            model_name="lead",
            name="demand_collected_declared",
            field=models.IntegerField(
                default=0,
                verbose_name="Собрано по заявленной квоте (чел.)",
            ),
        ),
        migrations.AddField(
            model_name="lead",
            name="demand_collected_list",
            field=models.IntegerField(
                default=0,
                verbose_name="Собрано по списочной квоте (чел.)",
            ),
        ),
        migrations.AddField(
            model_name="lead",
            name="demand_quota_declared",
            field=models.IntegerField(
                default=0,
                verbose_name="Квота заявленная (чел.)",
            ),
        ),
        migrations.AddField(
            model_name="lead",
            name="demand_quota_list",
            field=models.IntegerField(
                default=0,
                verbose_name="Квота списочная (чел.)",
            ),
        ),
    ]

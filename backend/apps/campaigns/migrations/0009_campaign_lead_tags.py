from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0008_campaign_project_and_org_fields"),
        ("organizations", "0004_autonomous_mode_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaign",
            name="tags",
            field=models.ManyToManyField(
                blank=True,
                related_name="campaigns",
                to="organizations.organizationtag",
                verbose_name="Теги",
            ),
        ),
        migrations.AddField(
            model_name="lead",
            name="tags",
            field=models.ManyToManyField(
                blank=True,
                related_name="leads",
                to="organizations.organizationtag",
                verbose_name="Теги",
            ),
        ),
    ]

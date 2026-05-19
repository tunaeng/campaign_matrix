from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("funnels", "0004_stagechecklistitem_confirmation_types"),
        ("organizations", "0004_autonomous_mode_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="funnel",
            name="tags",
            field=models.ManyToManyField(
                blank=True,
                related_name="funnels",
                to="organizations.organizationtag",
                verbose_name="Теги",
            ),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0004_autonomous_mode_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="contact",
            name="tags",
            field=models.ManyToManyField(
                blank=True,
                related_name="contacts",
                to="organizations.organizationtag",
                verbose_name="Теги",
            ),
        ),
    ]

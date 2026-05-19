# Generated manually for Bitrix sync

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0002_contact"),
    ]

    operations = [
        migrations.AddField(
            model_name="contact",
            name="bitrix_contact_id",
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                unique=True,
                verbose_name="ID контакта в Bitrix",
            ),
        ),
    ]

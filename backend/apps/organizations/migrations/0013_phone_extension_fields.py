# Телефон: добавочный номер (контакт, организация) + длина телефона организации

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0012_rename_private_org_type_label"),
    ]

    operations = [
        migrations.AddField(
            model_name="contact",
            name="phone_extension",
            field=models.CharField(
                blank=True,
                max_length=30,
                verbose_name="Добавочный",
            ),
        ),
        migrations.AddField(
            model_name="organization",
            name="contact_phone_extension",
            field=models.CharField(
                blank=True,
                max_length=30,
                verbose_name="Добавочный",
            ),
        ),
        migrations.AlterField(
            model_name="organization",
            name="contact_phone",
            field=models.CharField(
                blank=True,
                max_length=50,
                verbose_name="Телефон",
            ),
        ),
    ]

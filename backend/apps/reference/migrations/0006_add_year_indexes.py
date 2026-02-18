from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reference", "0005_professiondemandstatus_federal_operator"),
    ]

    operations = [
        migrations.AlterField(
            model_name="professiondemandstatus",
            name="year",
            field=models.IntegerField(db_index=True, default=2026, verbose_name="Год"),
        ),
        migrations.AlterField(
            model_name="professionapprovalstatus",
            name="year",
            field=models.IntegerField(db_index=True, default=2026, verbose_name="Год"),
        ),
    ]


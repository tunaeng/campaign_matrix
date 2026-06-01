from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0011_lead_region_and_unique_per_region"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "UPDATE campaigns_leadsubfunnel SET status = 'backlog' WHERE status = 'todo';",
                "UPDATE campaigns_leadsubfunnel SET status = 'paused' WHERE status = 'blocked';",
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

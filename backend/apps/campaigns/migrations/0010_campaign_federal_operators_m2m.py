from django.db import migrations, models


def populate_federal_operators(apps, schema_editor):
    Campaign = apps.get_model("campaigns", "Campaign")
    through = Campaign.federal_operators.through
    rows = []
    for campaign in Campaign.objects.exclude(federal_operator_id__isnull=True).only("id", "federal_operator_id"):
        rows.append(
            through(
                campaign_id=campaign.id,
                organization_id=campaign.federal_operator_id,
            )
        )
    if rows:
        through.objects.bulk_create(rows, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0009_campaign_lead_tags"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaign",
            name="federal_operators",
            field=models.ManyToManyField(
                blank=True,
                related_name="campaigns_as_federal_operator",
                to="organizations.organization",
                verbose_name="Федеральные операторы",
            ),
        ),
        migrations.RunPython(populate_federal_operators, migrations.RunPython.noop),
    ]

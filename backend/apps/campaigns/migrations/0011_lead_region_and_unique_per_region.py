from django.db import migrations, models


def populate_lead_region(apps, schema_editor):
    Lead = apps.get_model("campaigns", "Lead")
    for lead in Lead.objects.filter(region_id__isnull=True).select_related("organization"):
        org_region_id = getattr(lead.organization, "region_id", None)
        if org_region_id:
            lead.region_id = org_region_id
            lead.save(update_fields=["region"])


class Migration(migrations.Migration):
    dependencies = [
        ("reference", "0009_federal_operator_to_organization_fk"),
        ("campaigns", "0010_campaign_federal_operators_m2m"),
    ]

    operations = [
        migrations.AddField(
            model_name="lead",
            name="region",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="leads",
                to="reference.region",
                verbose_name="Регион лида",
            ),
        ),
        migrations.RunPython(populate_lead_region, migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name="lead",
            unique_together={("campaign", "organization", "funnel", "region")},
        ),
    ]

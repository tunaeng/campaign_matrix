from django.db import migrations, models
import django.db.models.deletion


def migrate_federal_operator_to_organization(apps, schema_editor):
    Campaign = apps.get_model("campaigns", "Campaign")
    FederalOperator = apps.get_model("reference", "FederalOperator")
    Organization = apps.get_model("organizations", "Organization")

    for campaign in Campaign.objects.exclude(federal_operator_old__isnull=True):
        old_id = campaign.federal_operator_old_id
        try:
            fo = FederalOperator.objects.get(id=old_id)
        except FederalOperator.DoesNotExist:
            continue
        org = Organization.objects.filter(name=fo.name).first()
        if org is None:
            inn = f"8{fo.id:011d}"[-12:]
            while Organization.objects.filter(inn=inn).exists():
                inn = str(int(inn) + 1)
            org = Organization.objects.create(
                name=fo.name,
                short_name=fo.short_name or fo.name[:200],
                description=fo.description or "",
                inn=inn,
            )
        campaign.federal_operator_id = org.id
        campaign.save(update_fields=["federal_operator"])


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0004_autonomous_mode_models"),
        ("campaigns", "0007_leadchecklistattachment"),
        ("reference", "0008_demand_import_snapshot"),
    ]

    operations = [
        migrations.RenameField(
            model_name="campaign",
            old_name="federal_operator",
            new_name="federal_operator_old",
        ),
        migrations.AddField(
            model_name="campaign",
            name="federal_operator",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="campaigns", to="organizations.organization", verbose_name="Федеральный оператор"),
        ),
        migrations.RunPython(migrate_federal_operator_to_organization, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="campaign",
            name="federal_operator_old",
        ),
        migrations.AddField(
            model_name="campaign",
            name="acting_organization",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="acting_campaigns", to="organizations.organization", verbose_name="От нашей организации"),
        ),
        migrations.AddField(
            model_name="campaign",
            name="project",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="campaigns", to="organizations.project", verbose_name="Проект"),
        ),
    ]

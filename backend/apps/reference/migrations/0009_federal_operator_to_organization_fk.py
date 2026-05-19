from django.db import migrations, models
import django.db.models.deletion


def ensure_organizations_for_federal_operators(apps, schema_editor):
    FederalOperator = apps.get_model("reference", "FederalOperator")
    Organization = apps.get_model("organizations", "Organization")

    for fo in FederalOperator.objects.all().order_by("id"):
        org = Organization.objects.filter(name=fo.name).first()
        if org:
            continue
        inn = f"7{fo.id:011d}"[-12:]
        while Organization.objects.filter(inn=inn).exists():
            inn = str(int(inn) + 1)
        Organization.objects.create(
            name=fo.name,
            short_name=fo.short_name or fo.name[:200],
            description=fo.description or "",
            inn=inn,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0004_autonomous_mode_models"),
        ("reference", "0008_demand_import_snapshot"),
        ("campaigns", "0008_campaign_project_and_org_fields"),
    ]

    operations = [
        migrations.RunPython(ensure_organizations_for_federal_operators, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="contract",
            name="federal_operator",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="contracts", to="organizations.organization", verbose_name="Федеральный оператор"),
        ),
        migrations.AlterField(
            model_name="demandimport",
            name="federal_operator",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="demand_imports", to="organizations.organization", verbose_name="Федеральный оператор"),
        ),
        migrations.AlterField(
            model_name="professiondemandstatus",
            name="federal_operator",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="demand_statuses", to="organizations.organization", verbose_name="Федеральный оператор"),
        ),
        migrations.AlterField(
            model_name="professiondemandstatushistory",
            name="federal_operator",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="demand_history_entries", to="organizations.organization", verbose_name="Федеральный оператор"),
        ),
        migrations.AlterField(
            model_name="quota",
            name="federal_operator",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="quotas", to="organizations.organization", verbose_name="Федеральный оператор"),
        ),
    ]

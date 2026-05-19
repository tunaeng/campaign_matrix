from django.db import migrations


DEFAULT_INN = "6321261206"
DEFAULT_NAME = (
    "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "
    "«Союз Энергетиков Поволжья»"
)
DEFAULT_SHORT_NAME = "ООО «СЭП»"
DEFAULT_NOTES = "ИНН/КПП 6321261206 / 632101001"


def create_default_organization(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    org_type_private = "private"
    existing = Organization.objects.filter(inn=DEFAULT_INN).first()
    if existing:
        changed = False
        if not existing.name:
            existing.name = DEFAULT_NAME
            changed = True
        if not existing.short_name:
            existing.short_name = DEFAULT_SHORT_NAME
            changed = True
        if not existing.notes:
            existing.notes = DEFAULT_NOTES
            changed = True
        if not existing.is_our_side:
            existing.is_our_side = True
            changed = True
        if existing.org_type != org_type_private:
            existing.org_type = org_type_private
            changed = True
        if changed:
            existing.save()
        return

    Organization.objects.create(
        name=DEFAULT_NAME,
        short_name=DEFAULT_SHORT_NAME,
        inn=DEFAULT_INN,
        org_type=org_type_private,
        notes=DEFAULT_NOTES,
        is_our_side=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0009_organization_org_type_new_choices"),
    ]

    operations = [
        migrations.RunPython(create_default_organization, migrations.RunPython.noop),
    ]

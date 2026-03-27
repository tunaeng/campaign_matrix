# Generated manually

import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0002_contact"),
        ("campaigns", "0004_leadactivitylog"),
    ]

    operations = [
        migrations.AddField(
            model_name="lead",
            name="primary_contact",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="primary_for_leads",
                to="organizations.contact",
                verbose_name="Основной контакт",
            ),
        ),
        migrations.AddConstraint(
            model_name="lead",
            constraint=models.UniqueConstraint(
                condition=Q(primary_contact__isnull=False),
                fields=("organization",),
                name="lead_org_single_primary_contact",
            ),
        ),
    ]

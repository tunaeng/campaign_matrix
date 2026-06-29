from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("campaigns", "0014_campaignsubfunnel_binding_campaignsubfunnel_campaign_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaign",
            name="responsible",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="responsible_campaigns",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Ответственный",
            ),
        ),
    ]

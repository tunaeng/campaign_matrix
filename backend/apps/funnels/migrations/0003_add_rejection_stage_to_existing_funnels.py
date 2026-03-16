from django.db import migrations


def add_rejection_stages(apps, schema_editor):
    Funnel = apps.get_model("funnels", "Funnel")
    FunnelStage = apps.get_model("funnels", "FunnelStage")

    for funnel in Funnel.objects.all():
        if not FunnelStage.objects.filter(funnel=funnel, is_rejection=True).exists():
            max_order = (
                FunnelStage.objects.filter(funnel=funnel)
                .order_by("-order")
                .values_list("order", flat=True)
                .first()
            ) or 0
            FunnelStage.objects.create(
                funnel=funnel,
                name="Отказ",
                order=max_order + 100,
                deadline_days=0,
                is_rejection=True,
            )


def remove_rejection_stages(apps, schema_editor):
    FunnelStage = apps.get_model("funnels", "FunnelStage")
    FunnelStage.objects.filter(is_rejection=True, name="Отказ").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("funnels", "0002_add_is_rejection_to_funnelstage"),
    ]

    operations = [
        migrations.RunPython(add_rejection_stages, remove_rejection_stages),
    ]

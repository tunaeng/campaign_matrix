from django.db import migrations


REMOVED_ROLE_CODES = {"lead_research_specialist", "primary_contact_specialist"}


def cleanup_task_roles(apps, schema_editor):
    RoleDefinition = apps.get_model("accounts", "RoleDefinition")
    SubfunnelTemplate = apps.get_model("funnels", "SubfunnelTemplate")
    SubfunnelTemplateBinding = apps.get_model("funnels", "SubfunnelTemplateBinding")
    SubfunnelTemplateItem = apps.get_model("funnels", "SubfunnelTemplateItem")
    CampaignSubfunnel = apps.get_model("campaigns", "CampaignSubfunnel")

    fallback = (
        RoleDefinition.objects.filter(code="communication_manager").first()
        or RoleDefinition.objects.filter(code="email_delivery_specialist").first()
    )
    removed_ids = list(
        RoleDefinition.objects.filter(code__in=REMOVED_ROLE_CODES).values_list("id", flat=True)
    )
    if not removed_ids:
        return

    fallback_id = fallback.id if fallback else None
    SubfunnelTemplate.objects.filter(owner_role_id__in=removed_ids).update(owner_role_id=fallback_id)
    SubfunnelTemplateBinding.objects.filter(role_id__in=removed_ids).update(role_id=fallback_id)
    SubfunnelTemplateItem.objects.filter(default_role_id__in=removed_ids).update(default_role_id=fallback_id)
    CampaignSubfunnel.objects.filter(role_id__in=removed_ids).update(role_id=fallback_id)
    RoleDefinition.objects.filter(id__in=removed_ids).update(is_active=False)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_role_definition"),
        ("funnels", "0015_canonical_task_funnels"),
        ("campaigns", "0014_campaignsubfunnel_binding_campaignsubfunnel_campaign_and_more"),
    ]

    operations = [
        migrations.RunPython(cleanup_task_roles, migrations.RunPython.noop),
    ]

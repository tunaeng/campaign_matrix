from django.db import migrations


CANONICAL_TASK_FUNNELS = [
    {
        "slug": "lead-search-and-capture",
        "name": "Поиск и занесение организаций/контактов",
        "stages": [
            {"order": 0, "name": "Поиск организаций", "is_work_stage": True, "is_active": True, "is_terminal": False, "sla_days": 0},
            {"order": 1, "name": "Верификация контактов", "is_work_stage": True, "is_active": True, "is_terminal": False, "sla_days": 0},
            {"order": 2, "name": "Готово", "is_work_stage": True, "is_active": True, "is_terminal": True, "sla_days": 0},
        ],
        "items": [
            {"order": 0, "title": "Найти подходящую организацию", "execution_type": "checklist_item", "stage_order": 0},
            {"order": 1, "title": "Добавить основные контакты", "execution_type": "checklist_item", "stage_order": 1},
        ],
    },
    {
        "slug": "email-and-primary-contact",
        "name": "Рассылка и первичный контакт",
        "stages": [
            {"order": 0, "name": "Подготовка письма", "is_work_stage": True, "is_active": True, "is_terminal": False, "sla_days": 0},
            {"order": 1, "name": "Рассылка", "is_work_stage": True, "is_active": True, "is_terminal": False, "sla_days": 0},
            {"order": 2, "name": "Ответ получен", "is_work_stage": True, "is_active": True, "is_terminal": True, "sla_days": 0},
        ],
        "items": [
            {"order": 0, "title": "Подготовить письмо", "execution_type": "stage_range_checklist", "stage_order": 0},
            {"order": 1, "title": "Отправить письмо", "execution_type": "stage_range_checklist", "stage_order": 1},
            {"order": 2, "title": "Зафиксировать ответ", "execution_type": "stage_range_checklist", "stage_order": 2},
        ],
    },
]


def ensure_canonical_task_funnels(apps, schema_editor):
    SubfunnelTemplate = apps.get_model("funnels", "SubfunnelTemplate")
    TaskTemplateStage = apps.get_model("funnels", "TaskTemplateStage")
    SubfunnelTemplateItem = apps.get_model("funnels", "SubfunnelTemplateItem")
    CampaignSubfunnel = apps.get_model("campaigns", "CampaignSubfunnel")
    SubfunnelTemplateBinding = apps.get_model("funnels", "SubfunnelTemplateBinding")

    canonical_slugs = {spec["slug"] for spec in CANONICAL_TASK_FUNNELS}

    for spec in CANONICAL_TASK_FUNNELS:
        template, _ = SubfunnelTemplate.objects.update_or_create(
            slug=spec["slug"],
            defaults={
                "name": spec["name"],
                "is_active": True,
            },
        )

        stage_by_order = {}
        for stage_spec in spec["stages"]:
            stage, _ = TaskTemplateStage.objects.update_or_create(
                template=template,
                order=stage_spec["order"],
                defaults={
                    "name": stage_spec["name"],
                    "is_work_stage": stage_spec["is_work_stage"],
                    "is_active": stage_spec["is_active"],
                    "is_terminal": stage_spec["is_terminal"],
                    "sla_days": stage_spec["sla_days"],
                },
            )
            stage_by_order[stage_spec["order"]] = stage

        for item_spec in spec["items"]:
            stage = stage_by_order.get(item_spec["stage_order"])
            SubfunnelTemplateItem.objects.update_or_create(
                template=template,
                order=item_spec["order"],
                defaults={
                    "title": item_spec["title"],
                    "execution_type": item_spec["execution_type"],
                    "stage": stage,
                },
            )

    for template in SubfunnelTemplate.objects.exclude(slug__in=canonical_slugs):
        in_use = (
            CampaignSubfunnel.objects.filter(template=template).exists()
            or SubfunnelTemplateBinding.objects.filter(template=template).exists()
        )
        if in_use:
            template.is_active = False
            template.save(update_fields=["is_active"])
        else:
            template.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("funnels", "0014_tasktemplatestage_is_work_stage_and_is_active"),
        ("campaigns", "0014_campaignsubfunnel_binding_campaignsubfunnel_campaign_and_more"),
    ]

    operations = [
        migrations.RunPython(ensure_canonical_task_funnels, migrations.RunPython.noop),
    ]

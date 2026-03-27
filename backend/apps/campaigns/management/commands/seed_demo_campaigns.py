"""
Три демо-кампании с очередью, воронкой и лидами по демо-организациям.

Сначала выполните: python manage.py seed_demo_organizations

  python manage.py seed_demo_campaigns

Повторный запуск обновляет кампании с теми же названиями.
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.campaigns.models import (
    Campaign,
    CampaignFunnel,
    CampaignOrganization,
    CampaignProgram,
    CampaignQueue,
    CampaignRegion,
    Lead,
    QueueStageDeadline,
)
from apps.funnels.models import Funnel, FunnelStage
from apps.organizations.models import Organization
from apps.reference.models import FederalOperator, Profession, Program, Region

# Те же названия, что в seed_demo_organizations
DEMO_ORG_NAMES = [
    'ГБУЗ "Городская клиническая больница № 1" г. Москвы',
    'ООО "ПромТехСервис" (демо)',
    'АНО "Центр образовательных технологий" (демо)',
]

CAMPAIGNS = [
    {
        "name": "Демо-кампания 1: Сбор потребности (тест)",
        "status": Campaign.Status.DRAFT,
        "hypothesis": "Проверка готовности работодателей к заявкам в Q1.",
        "org_index": 0,
        "forecast": 120,
    },
    {
        "name": "Демо-кампания 2: Пилот промышленность",
        "status": Campaign.Status.ACTIVE,
        "hypothesis": "Пилот по программам для промпредприятий.",
        "org_index": 1,
        "forecast": 80,
    },
    {
        "name": "Демо-кампания 3: Образование и доп. квалификация",
        "status": Campaign.Status.PAUSED,
        "hypothesis": "Охват образовательных центров в регионе.",
        "org_index": 2,
        "forecast": 200,
    },
]


def _ensure_funnel():
    funnel = Funnel.objects.order_by("id").first()
    if funnel:
        funnel.ensure_rejection_stage()
        return funnel
    funnel = Funnel.objects.create(
        name="Демо-воронка (тест)",
        description="Автоматически создана для демо-кампаний.",
    )
    FunnelStage.objects.create(
        funnel=funnel,
        name="Первичный контакт",
        order=1,
        deadline_days=5,
    )
    FunnelStage.objects.create(
        funnel=funnel,
        name="Согласование потребности",
        order=2,
        deadline_days=10,
    )
    funnel.ensure_rejection_stage()
    return funnel


def _ensure_program():
    prog = Program.objects.order_by("id").first()
    if prog:
        return prog
    prof = Profession.objects.order_by("id").first()
    if not prof:
        prof = Profession.objects.create(number=90001, name="Демо-профессия (тест)")
    return Program.objects.create(
        name="Демо-программа переподготовки.",
        profession=prof,
        hours=256,
    )


def _ensure_federal_operator():
    fo = FederalOperator.objects.order_by("id").first()
    if fo:
        return fo
    return FederalOperator.objects.create(
        name='ФО "Демо" (тест)',
        short_name="ДемоФО",
    )


def _fill_queue_deadlines(queue, funnel):
    for stage in funnel.stages.exclude(is_rejection=True).order_by("order"):
        QueueStageDeadline.objects.update_or_create(
            queue=queue,
            funnel_stage=stage,
            defaults={"deadline_days": 3 + min(stage.order * 2, 20)},
        )


class Command(BaseCommand):
    help = "Создаёт или обновляет 3 демо-кампании с очередью, воронкой и лидом"

    def handle(self, *args, **options):
        User = get_user_model()
        user = User.objects.filter(is_superuser=True).first() or User.objects.order_by("id").first()

        orgs = []
        for name in DEMO_ORG_NAMES:
            o = Organization.objects.filter(name=name).first()
            if o:
                orgs.append(o)
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'Организация не найдена («{name}»). Запустите: python manage.py seed_demo_organizations'
                    )
                )

        if len(orgs) != len(DEMO_ORG_NAMES):
            self.stdout.write(
                self.style.ERROR("Нужны все 3 демо-организации. Кампании созданы без лидов.")
            )

        funnel = _ensure_funnel()
        program = _ensure_program()
        fo = _ensure_federal_operator()
        region = Region.objects.order_by("id").first()
        first_stage = funnel.stages.filter(is_rejection=False).order_by("order").first()

        if not region:
            self.stdout.write(self.style.WARNING("В БД нет регионов — регионы в кампаниях не добавлены."))

        today = date.today()
        created = 0
        updated = 0

        for spec in CAMPAIGNS:
            campaign, was_created = Campaign.objects.update_or_create(
                name=spec["name"],
                defaults={
                    "status": spec["status"],
                    "hypothesis": spec["hypothesis"],
                    "federal_operator": fo,
                    "created_by": user,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

            CampaignFunnel.objects.get_or_create(campaign=campaign, funnel=funnel)

            queue, _ = CampaignQueue.objects.update_or_create(
                campaign=campaign,
                queue_number=1,
                defaults={
                    "name": "Очередь 1",
                    "start_date": today,
                    "end_date": today + timedelta(days=120),
                },
            )
            _fill_queue_deadlines(queue, funnel)

            CampaignProgram.objects.get_or_create(
                campaign=campaign,
                program=program,
                defaults={"manager": None},
            )

            if region:
                CampaignRegion.objects.get_or_create(
                    campaign=campaign,
                    region=region,
                    defaults={"queue": queue, "manager": None},
                )

            idx = spec["org_index"]
            if idx < len(orgs):
                org = orgs[idx]
                CampaignOrganization.objects.update_or_create(
                    campaign=campaign,
                    organization=org,
                    defaults={
                        "status": CampaignOrganization.Status.CONTACTED,
                        "demand_count": spec["forecast"] // 4,
                        "notes": "Демо-запись для тестов.",
                    },
                )
                Lead.objects.update_or_create(
                    campaign=campaign,
                    organization=org,
                    funnel=funnel,
                    defaults={
                        "queue": queue,
                        "current_stage": first_stage,
                        "forecast_demand": spec["forecast"],
                        "demand_count": spec["forecast"] // 10,
                        "demand_quota_declared": spec["forecast"] // 2,
                        "demand_quota_list": spec["forecast"] // 3,
                        "demand_collected_declared": spec["forecast"] // 5,
                        "demand_collected_list": spec["forecast"] // 6,
                    },
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Готово: кампаний создано {created}, обновлено {updated}. "
                f"Воронка: «{funnel.name}». Лиды: по одному на кампанию (если организации есть)."
            )
        )

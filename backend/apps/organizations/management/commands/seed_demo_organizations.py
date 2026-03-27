"""
Три демо-компании с контактами и историей взаимодействий для тестирования.

  python manage.py seed_demo_organizations

Повторный запуск обновляет те же записи (по полю name).
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.organizations.models import Contact, Organization, OrganizationInteraction
from apps.reference.models import FederalDistrict, Region


def _ensure_region():
    region = Region.objects.order_by("id").first()
    if region:
        return region
    fd = FederalDistrict.objects.create(
        name="Тестовый федеральный округ",
        code="TEST_FO",
        short_name="ТФО",
    )
    return Region.objects.create(
        name="Тестовый регион",
        code="TR",
        federal_district=fd,
    )


ORGS = [
    {
        "name": 'ГБУЗ "Городская клиническая больница № 1" г. Москвы',
        "short_name": "ГКБ №1",
        "inn": "7701234560",
        "org_type": Organization.OrgType.HEALTHCARE,
        "contact_person": "Смирнова Анна Петровна",
        "contact_email": "smirnova@gkb1-demo.test",
        "contact_phone": "+7 (495) 100-01-01",
        "notes": "Демо: здравоохранение, кадры среднего звена.",
        "contacts": [
            {
                "type": Contact.ContactType.PERSON,
                "last_name": "Смирнова",
                "first_name": "Анна",
                "middle_name": "Петровна",
                "position": "Главный врач",
                "phone": "+7 495 100-01-02",
                "email": "smirnova@gkb1-demo.test",
                "is_manager": True,
            },
            {
                "type": Contact.ContactType.PERSON,
                "last_name": "Кузнецов",
                "first_name": "Дмитрий",
                "middle_name": "Игоревич",
                "position": "Зав. отделом кадров",
                "phone": "+7 495 100-01-03",
                "email": "kuznetsov@gkb1-demo.test",
                "is_manager": False,
            },
            {
                "type": Contact.ContactType.DEPARTMENT,
                "department_name": "Отдел образовательных программ",
                "comment": "Координация практик и стажировок",
            },
        ],
        "interactions": [
            (
                OrganizationInteraction.InteractionType.PHONE,
                "Первичный звонок: согласие на участие в опросе потребности.",
            ),
            (
                OrganizationInteraction.InteractionType.MEETING,
                "Онлайн-встреча с HR: обсуждены сроки подачи заявок.",
            ),
        ],
    },
    {
        "name": 'ООО "ПромТехСервис" (демо)',
        "short_name": "ПромТехСервис",
        "inn": "7702234567",
        "org_type": Organization.OrgType.ENTERPRISE,
        "contact_person": "Волков Сергей",
        "contact_email": "info@promtech-demo.test",
        "contact_phone": "+7 (495) 200-02-00",
        "notes": "Демо: промышленное предприятие, сварочное производство.",
        "contacts": [
            {
                "type": Contact.ContactType.PERSON,
                "last_name": "Волков",
                "first_name": "Сергей",
                "middle_name": "Александрович",
                "position": "Директор по персоналу",
                "phone": "+7 495 200-02-01",
                "email": "volkov@promtech-demo.test",
                "is_manager": True,
            },
            {
                "type": Contact.ContactType.PERSON,
                "last_name": "Новикова",
                "first_name": "Елена",
                "middle_name": "Сергеевна",
                "position": "Главный инженер",
                "phone": "+7 495 200-02-02",
                "email": "novikova@promtech-demo.test",
                "is_manager": False,
            },
        ],
        "interactions": [
            (
                OrganizationInteraction.InteractionType.EMAIL,
                "Отправлено коммерческое предложение по программе переподготовки.",
            ),
        ],
    },
    {
        "name": 'АНО "Центр образовательных технологий" (демо)',
        "short_name": "ЦОТ демо",
        "inn": "7703234568",
        "org_type": Organization.OrgType.EDUCATION,
        "contact_person": "Орлова Мария",
        "contact_email": "office@cot-demo.test",
        "contact_phone": "+7 (495) 300-03-00",
        "notes": "Демо: дополнительное образование, цифровые курсы.",
        "contacts": [
            {
                "type": Contact.ContactType.PERSON,
                "last_name": "Орлова",
                "first_name": "Мария",
                "middle_name": "Викторовна",
                "position": "Руководитель программ",
                "phone": "+7 495 300-03-01",
                "email": "orlova@cot-demo.test",
                "is_manager": True,
            },
            {
                "type": Contact.ContactType.MAIN,
                "comment": "Общий ящик для заявок от образовательных партнёров",
            },
            {
                "type": Contact.ContactType.PERSON,
                "last_name": "Петров",
                "first_name": "Илья",
                "middle_name": "",
                "position": "Методист",
                "phone": "+7 495 300-03-02",
                "email": "petrov@cot-demo.test",
                "is_manager": False,
            },
        ],
        "interactions": [
            (
                OrganizationInteraction.InteractionType.PHONE,
                "Уточнение числа слушателей по очной форме.",
            ),
            (
                OrganizationInteraction.InteractionType.LETTER,
                "Получено письмо с подписанным соглашением о сотрудничестве (скан).",
            ),
        ],
    },
]


class Command(BaseCommand):
    help = "Создаёт или обновляет 3 демо-организации с контактами и взаимодействиями"

    def handle(self, *args, **options):
        region = _ensure_region()
        today = timezone.localdate()
        created_orgs = 0
        updated_orgs = 0
        contacts_n = 0
        interactions_n = 0

        for spec in ORGS:
            org, created = Organization.objects.update_or_create(
                name=spec["name"],
                defaults={
                    "short_name": spec["short_name"],
                    "inn": spec["inn"],
                    "org_type": spec["org_type"],
                    "region": region,
                    "contact_person": spec["contact_person"],
                    "contact_email": spec["contact_email"],
                    "contact_phone": spec["contact_phone"],
                    "notes": spec["notes"],
                },
            )
            if created:
                created_orgs += 1
            else:
                updated_orgs += 1

            # Контакты: пересоздаём набор для предсказуемого демо (удаляем старые демо-контакты по org)
            Contact.objects.filter(organization=org).delete()
            for c in spec["contacts"]:
                kw = {
                    "organization": org,
                    "type": c["type"],
                    "comment": c.get("comment", ""),
                    "current": True,
                }
                if c["type"] == Contact.ContactType.PERSON:
                    kw.update(
                        last_name=c.get("last_name", ""),
                        first_name=c.get("first_name", ""),
                        middle_name=c.get("middle_name", ""),
                        position=c.get("position", ""),
                        phone=c.get("phone", ""),
                        email=c.get("email", ""),
                        is_manager=c.get("is_manager", False),
                    )
                elif c["type"] == Contact.ContactType.DEPARTMENT:
                    kw["department_name"] = c.get("department_name", "")
                elif c["type"] == Contact.ContactType.MAIN:
                    pass
                Contact.objects.create(**kw)
                contacts_n += 1

            OrganizationInteraction.objects.filter(organization=org).delete()
            for i, (itype, note) in enumerate(spec["interactions"]):
                OrganizationInteraction.objects.create(
                    organization=org,
                    date=today - timedelta(days=14 - i * 3),
                    interaction_type=itype,
                    notes=note,
                )
                interactions_n += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Готово: организаций создано {created_orgs}, обновлено {updated_orgs}; "
                f"контактов {contacts_n}, взаимодействий {interactions_n}. "
                f"Регион: {region.name}."
            )
        )

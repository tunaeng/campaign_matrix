from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def fill_missing_or_duplicate_inn(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    used = set()
    for org in Organization.objects.order_by("id"):
        inn = (org.inn or "").strip()
        if not inn or inn in used:
            generated = f"9{org.id:011d}"[-12:]
            while generated in used:
                generated = str(int(generated) + 1)
            org.inn = generated
            org.save(update_fields=["inn"])
            inn = generated
        used.add(inn)


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0003_contact_bitrix_contact_id"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BitrixOAuthConnection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(default="default", max_length=150, unique=True)),
                ("client_id", models.CharField(blank=True, max_length=255)),
                ("client_secret", models.CharField(blank=True, max_length=255)),
                ("access_token", models.TextField(blank=True)),
                ("refresh_token", models.TextField(blank=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("base_url", models.URLField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Bitrix OAuth подключение",
                "verbose_name_plural": "Bitrix OAuth подключения",
            },
        ),
        migrations.CreateModel(
            name="OrganizationTag",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, unique=True, verbose_name="Название")),
                ("slug", models.SlugField(max_length=120, unique=True, verbose_name="Код")),
                ("color", models.CharField(blank=True, max_length=20, verbose_name="Цвет")),
            ],
            options={
                "verbose_name": "Тег организации",
                "verbose_name_plural": "Теги организаций",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="Project",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=300, verbose_name="Название")),
                ("year", models.PositiveSmallIntegerField(verbose_name="Год")),
                ("code", models.CharField(blank=True, max_length=100, verbose_name="Код")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Проект",
                "verbose_name_plural": "Проекты",
                "ordering": ["-year", "name"],
            },
        ),
        migrations.CreateModel(
            name="ProjectOrganizationMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("customer", "Заказчик"), ("federal_operator", "Федеральный оператор"), ("participant", "Участник"), ("contractor", "Подрядчик"), ("implementer", "Исполнитель")], max_length=40, verbose_name="Роль")),
                ("notes", models.TextField(blank=True, verbose_name="Примечания")),
                ("sort_order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="project_memberships", to="organizations.organization", verbose_name="Организация")),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to="organizations.project", verbose_name="Проект")),
            ],
            options={
                "verbose_name": "Роль организации в проекте",
                "verbose_name_plural": "Роли организаций в проектах",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="UserActingOrganization",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_primary", models.BooleanField(default=False, verbose_name="Основная")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assigned_users", to="organizations.organization", verbose_name="Организация")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="acting_organizations", to=settings.AUTH_USER_MODEL, verbose_name="Пользователь")),
            ],
            options={
                "verbose_name": "Организация пользователя",
                "verbose_name_plural": "Организации пользователей",
            },
        ),
        migrations.AddField(
            model_name="organization",
            name="description",
            field=models.TextField(blank=True, verbose_name="Описание"),
        ),
        migrations.AddField(
            model_name="organization",
            name="is_our_side",
            field=models.BooleanField(default=False, verbose_name="Наша организация"),
        ),
        migrations.AddField(
            model_name="organization",
            name="tags",
            field=models.ManyToManyField(blank=True, related_name="organizations", to="organizations.organizationtag", verbose_name="Теги"),
        ),
        migrations.AddField(
            model_name="organizationinteraction",
            name="acting_organization",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="acting_interactions", to="organizations.organization", verbose_name="От нашей организации"),
        ),
        migrations.AddField(
            model_name="organizationinteraction",
            name="project",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="interactions", to="organizations.project", verbose_name="Проект"),
        ),
        migrations.RunPython(fill_missing_or_duplicate_inn, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="organization",
            name="inn",
            field=models.CharField(max_length=12, unique=True, verbose_name="ИНН"),
        ),
        migrations.AddField(
            model_name="project",
            name="organizations",
            field=models.ManyToManyField(related_name="projects", through="organizations.ProjectOrganizationMembership", to="organizations.organization", verbose_name="Организации"),
        ),
        migrations.AddConstraint(
            model_name="project",
            constraint=models.UniqueConstraint(fields=("name", "year"), name="project_name_year_unique"),
        ),
        migrations.AddConstraint(
            model_name="projectorganizationmembership",
            constraint=models.UniqueConstraint(fields=("project", "organization", "role"), name="project_org_role_unique"),
        ),
        migrations.AddConstraint(
            model_name="projectorganizationmembership",
            constraint=models.UniqueConstraint(condition=models.Q(role="customer"), fields=("project",), name="project_single_customer_unique"),
        ),
        migrations.AddConstraint(
            model_name="useractingorganization",
            constraint=models.UniqueConstraint(fields=("user", "organization"), name="user_acting_organization_unique"),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0005_contact_tags"),
    ]

    operations = [
        migrations.AddField(
            model_name="organizationtag",
            name="category",
            field=models.CharField(
                blank=True,
                help_text="Необязательная папка для группировки тегов в фильтрах",
                max_length=120,
                verbose_name="Категория",
            ),
        ),
        migrations.AddField(
            model_name="organizationtag",
            name="tag_type",
            field=models.CharField(
                choices=[
                    ("all", "Все сущности"),
                    ("organizations", "Организации"),
                    ("contacts", "Контакты"),
                    ("funnels", "Воронки"),
                    ("campaigns", "Кампании"),
                    ("leads", "Лиды"),
                ],
                default="all",
                max_length=20,
                verbose_name="Тип",
            ),
        ),
    ]

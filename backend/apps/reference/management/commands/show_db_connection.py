"""Показать, к какой БД реально подключён Django (migrate / runserver / gunicorn должны совпадать)."""

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Вывести параметры default database и для Postgres — имя базы из сервера"

    def handle(self, *args, **options):
        db = settings.DATABASES["default"]
        engine = db.get("ENGINE", "")
        name = db.get("NAME", "")
        self.stdout.write(self.style.NOTICE("=== Django DATABASES['default'] ==="))
        self.stdout.write(f"ENGINE: {engine}")
        self.stdout.write(f"NAME:   {name}")
        if db.get("HOST"):
            self.stdout.write(f"HOST:   {db.get('HOST')}")
            self.stdout.write(f"PORT:   {db.get('PORT')}")
            self.stdout.write(f"USER:   {db.get('USER')}")

        self.stdout.write("")
        try:
            with connection.cursor() as c:
                if "postgresql" in engine:
                    c.execute("SELECT current_database(), current_user, inet_server_addr(), inet_server_port();")
                    row = c.fetchone()
                    self.stdout.write(self.style.SUCCESS("Подключение OK (PostgreSQL):"))
                    self.stdout.write(f"  current_database(): {row[0]}")
                    self.stdout.write(f"  current_user:       {row[1]}")
                    self.stdout.write(f"  server addr:port:   {row[2]}:{row[3]}")
                elif "sqlite" in engine:
                    c.execute("SELECT sqlite_version();")
                    self.stdout.write(self.style.SUCCESS("Подключение OK (SQLite):"))
                    self.stdout.write(f"  sqlite_version: {c.fetchone()[0]}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Ошибка запроса к БД: {e}"))

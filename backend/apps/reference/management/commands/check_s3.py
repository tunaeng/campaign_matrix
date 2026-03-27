"""Проверка подключения к S3 (REG.RU Cloud и совместимые API) и работы Django storages."""

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Проверить DJANGO_USE_S3, boto3 к endpoint и запись через default_storage"

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-write",
            action="store_true",
            help="Не писать тестовый объект в бакет (только list/head)",
        )

    def handle(self, *args, **options):
        if not getattr(settings, "USE_S3_STORAGE", False):
            self.stdout.write(
                self.style.WARNING(
                    "DJANGO_USE_S3 не включён — в .env задайте DJANGO_USE_S3=true и ключи AWS_*."
                )
            )
            return

        required = (
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_STORAGE_BUCKET_NAME",
        )
        missing = [k for k in required if not getattr(settings, k, None)]
        if missing:
            self.stdout.write(
                self.style.ERROR(
                    "Не заданы переменные: " + ", ".join(missing)
                )
            )
            return

        endpoint = settings.AWS_S3_ENDPOINT_URL
        bucket = settings.AWS_STORAGE_BUCKET_NAME
        region = settings.AWS_S3_REGION_NAME
        addr_style = getattr(settings, "AWS_S3_ADDRESSING_STYLE", "path")

        self.stdout.write(self.style.NOTICE("=== Параметры из Django settings ==="))
        self.stdout.write(f"Endpoint:     {endpoint}")
        self.stdout.write(f"Bucket:       {bucket}")
        self.stdout.write(f"Region:       {region}")
        self.stdout.write(f"Addressing:   {addr_style}")
        key_id = settings.AWS_ACCESS_KEY_ID
        self.stdout.write(f"Access key:   {key_id[:4]}…{key_id[-4:]}" if len(key_id) > 8 else "(короткий ключ)")

        boto_cfg = BotoConfig(
            region_name=region,
            signature_version=getattr(settings, "AWS_S3_SIGNATURE_VERSION", "s3v4"),
            s3={"addressing_style": addr_style},
        )

        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=boto_cfg,
        )

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("=== boto3: доступ к бакету ==="))
        try:
            client.head_bucket(Bucket=bucket)
            self.stdout.write(self.style.SUCCESS("head_bucket: OK"))
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            # часть провайдеров отвечает 404/403 на head — пробуем list
            self.stdout.write(f"head_bucket: {code or e} — пробуем list_objects_v2…")
            try:
                client.list_objects_v2(Bucket=bucket, MaxKeys=1)
                self.stdout.write(self.style.SUCCESS("list_objects_v2: OK"))
            except ClientError as e2:
                self.stdout.write(self.style.ERROR(f"list_objects_v2: {e2}"))
                return

        if options["no_write"]:
            self.stdout.write(self.style.SUCCESS("\nПроверка завершена (--no-write)."))
            return

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("=== Django default_storage: запись / чтение / удаление ==="))
        probe = "__django_s3_probe.txt"
        try:
            path = default_storage.save(probe, ContentFile(b"matrix-s3-ok"))
            self.stdout.write(f"save → {path}")
            with default_storage.open(path, "rb") as f:
                data = f.read()
            if data != b"matrix-s3-ok":
                self.stdout.write(self.style.ERROR("Содержимое после чтения не совпадает"))
                return
            self.stdout.write(self.style.SUCCESS("read: OK"))
            default_storage.delete(path)
            self.stdout.write(self.style.SUCCESS("delete: OK"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Ошибка storage: {e}"))
            return

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS("Итог: подключение к S3 и django-storages работают.")
        )

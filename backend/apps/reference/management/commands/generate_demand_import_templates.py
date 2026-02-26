# -*- coding: utf-8 -*-
"""
Генерация шаблонов CSV для импорта востребованности.
Два формата: матрица (wide) и построчный (row-based).
"""
import csv
import os
from django.core.management.base import BaseCommand
from apps.reference.models import Region


class Command(BaseCommand):
    help = "Generate CSV templates for demand matrix import (wide matrix and row-based)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-dir",
            type=str,
            default=None,
            help="Directory to write template files (default: backend/data/demand_import_templates)",
        )

    def handle(self, *args, **options):
        out_dir = options["output_dir"]
        if not out_dir:
            base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))
            out_dir = os.path.join(base, "data", "demand_import_templates")
        os.makedirs(out_dir, exist_ok=True)

        regions = list(Region.objects.order_by("name").values_list("name", flat=True))
        if not regions:
            self.stdout.write(self.style.WARNING("No regions in DB. Wide template will have no region columns."))

        # --- Шаблон "матрица": строки = профессии, столбцы = регионы, на перекрёстке 1 или 0
        # Строка 0: название колонки профессий + регионы. Строка 1+: профессия, 0/1 по регионам
        profession_header = "Наименование направлений подготовки, специальностей, профессий"
        wide_path = os.path.join(out_dir, "demand_matrix_import_template_wide.csv")
        with open(wide_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f, delimiter=";")
            writer.writerow([profession_header] + list(regions))
            example = ["Пример профессии"] + (["0"] * len(regions))
            if regions:
                example[1] = "1"
            writer.writerow(example)
        self.stdout.write(self.style.SUCCESS(f"Wrote: {wide_path}"))

        # --- То же в XLSX (как в образце)
        try:
            import openpyxl
            xlsx_path = os.path.join(out_dir, "demand_matrix_import_template_wide.xlsx")
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Востребованность"
            ws.append([profession_header] + list(regions))
            ws.append(["Пример профессии"] + ([0] * len(regions)))
            if regions:
                ws.cell(row=2, column=2, value=1)
            wb.save(xlsx_path)
            self.stdout.write(self.style.SUCCESS(f"Wrote: {xlsx_path}"))
        except ImportError:
            pass

        # --- Шаблон построчный (row-based)
        row_path = os.path.join(out_dir, "demand_matrix_import_template_row.csv")
        with open(row_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f, delimiter=";")
            writer.writerow(["код_профессии", "профессия", "регион", "востребована", "год"])
            if regions:
                writer.writerow(["1", "Пример профессии", regions[0], "1", "2026"])
                writer.writerow(["1", "Пример профессии", regions[1] if len(regions) > 1 else regions[0], "0", "2026"])
            else:
                writer.writerow(["1", "Пример профессии", "Название региона из справочника", "1", "2026"])
        self.stdout.write(self.style.SUCCESS(f"Wrote: {row_path}"))

        self.stdout.write("Templates: wide matrix (rows 0=header, 2+=data) and row-based (columns: profession, region, is_demanded).")

import csv
from django.core.management.base import BaseCommand
from apps.reference.models import Profession, Region, ProfessionDemandStatus


class Command(BaseCommand):
    help = "Load profession demand matrix from CSV file"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            required=True,
            help="Path to CSV file with demand matrix",
        )
        parser.add_argument(
            "--year",
            type=int,
            default=2026,
            help="Year for demand data (default: 2026)",
        )

    def handle(self, *args, **options):
        filepath = options["file"]
        year = options["year"]

        self.stdout.write(f"Loading demand matrix from {filepath} for year {year}")

        region_map = {}
        for r in Region.objects.all():
            region_map[r.name.strip().lower()] = r

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)

            region_names = header[2:]
            region_objects = []
            for rname in region_names:
                rname_clean = rname.strip()
                rname_lower = rname_clean.lower()
                region = region_map.get(rname_lower)
                if not region:
                    for key, reg in region_map.items():
                        if rname_lower in key or key in rname_lower:
                            region = reg
                            break
                region_objects.append(region)
                if not region:
                    self.stdout.write(
                        self.style.WARNING(f"  Region not found: '{rname_clean}'")
                    )

            next(reader)

            professions_created = 0
            statuses_created = 0

            for row in reader:
                if len(row) < 3:
                    continue

                try:
                    prof_number = int(row[0].strip())
                except (ValueError, IndexError):
                    continue

                prof_name = row[1].strip().strip('"')
                if not prof_name:
                    continue

                profession, created = Profession.objects.update_or_create(
                    number=prof_number,
                    defaults={"name": prof_name},
                )
                if created:
                    professions_created += 1

                for i, region in enumerate(region_objects):
                    if region is None:
                        continue
                    if i + 2 >= len(row):
                        break

                    value = row[i + 2].strip().lower()
                    is_demanded = value in ("да", "yes", "1", "true")

                    _, s_created = ProfessionDemandStatus.objects.update_or_create(
                        profession=profession,
                        region=region,
                        year=year,
                        defaults={"is_demanded": is_demanded},
                    )
                    if s_created:
                        statuses_created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done! Professions: {professions_created} created. "
                f"Demand statuses: {statuses_created} created/updated."
            )
        )

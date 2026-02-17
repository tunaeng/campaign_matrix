import random
from django.core.management.base import BaseCommand
from apps.reference.models import (
    Profession, Region, ProfessionDemandStatus, ProfessionApprovalStatus
)


class Command(BaseCommand):
    help = 'Generate test approval statuses for demanded professions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--year',
            type=int,
            default=2026,
            help='Year for status generation'
        )
        parser.add_argument(
            '--coverage',
            type=float,
            default=0.4,
            help='Percentage of demanded professions to generate statuses for (0.0-1.0)'
        )

    def handle(self, *args, **options):
        year = options['year']
        coverage = options['coverage']

        # Get all profession-region pairs (both demanded and not demanded)
        all_pairs = ProfessionDemandStatus.objects.filter(
            year=year
        ).select_related('profession', 'region')

        if not all_pairs.exists():
            self.stdout.write(self.style.ERROR(
                f'No profession-region pairs found for year {year}. '
                'Please load demand matrix first.'
            ))
            return

        # Delete existing statuses for this year
        deleted_count = ProfessionApprovalStatus.objects.filter(year=year).count()
        ProfessionApprovalStatus.objects.filter(year=year).delete()
        self.stdout.write(f'Deleted {deleted_count} existing statuses')

        # Generate statuses for random sample of all pairs (not just demanded)
        total_pairs = all_pairs.count()
        sample_size = int(total_pairs * coverage)
        sample = random.sample(list(all_pairs), sample_size)

        # Распределение по статусам
        status_weights = {
            'in_progress': 0.20,           # 20% - в проработке
            'preliminary_approved': 0.25,  # 25% - предварительно одобрено
            'approved': 0.35,              # 35% - одобрено по факту
            'rejected': 0.10,              # 10% - отказано
            'unlikely': 0.10,              # 10% - маловероятно
        }

        statuses_to_create = []
        for demand_status in sample:
            status = random.choices(
                list(status_weights.keys()),
                weights=list(status_weights.values())
            )[0]

            # Generate notes based on status
            notes_templates = {
                'in_progress': [
                    'Under review by Ministry department',
                    'Documents submitted, awaiting decision',
                    'In discussion with regional authorities',
                ],
                'preliminary_approved': [
                    'Preliminarily approved at meeting with Ministry representative',
                    'Received verbal approval, awaiting formal confirmation',
                    'Profession included in preliminary approval list',
                ],
                'approved': [
                    'Approved based on actual stream implementation in 2025',
                    'Confirmed by Ministry letter dated current year',
                    'Profession approved within federal program framework',
                ],
                'rejected': [
                    'Rejected due to low labor market demand',
                    'Does not meet Ministry priorities for current year',
                    'Region not included in program for this profession',
                ],
                'unlikely': [
                    'Unlikely approval due to budget constraints',
                    'Requires additional demand justification',
                    'Expected review in next quarter',
                ],
            }

            approval = ProfessionApprovalStatus(
                profession=demand_status.profession,
                region=demand_status.region,
                year=year,
                approval_status=status,
                notes=random.choice(notes_templates[status])
            )

            # For "approved" status add approval date
            if status == 'approved':
                # Generate random date in current year
                import datetime
                start_date = datetime.date(year, 1, 1)
                days_offset = random.randint(0, 180)  # first 6 months
                approval.approved_date = start_date + datetime.timedelta(days=days_offset)

            statuses_to_create.append(approval)

        # Bulk create for performance
        ProfessionApprovalStatus.objects.bulk_create(statuses_to_create)

        self.stdout.write(self.style.SUCCESS(
            f'Created {len(statuses_to_create)} approval statuses for year {year}'
        ))
        self.stdout.write(f'Coverage: {coverage*100}% of {total_pairs} profession-region pairs')
        
        # Count how many are for demanded professions
        demanded_count = sum(1 for s in sample if s.is_demanded)
        self.stdout.write(f'  Including {demanded_count} demanded and {len(sample) - demanded_count} not demanded')

        # Print statistics by status
        for status, _ in ProfessionApprovalStatus.ApprovalStatus.choices:
            count = sum(1 for a in statuses_to_create if a.approval_status == status)
            if count > 0:
                self.stdout.write(f'  {status}: {count}')

from datetime import date, timedelta


def add_business_days(start: date, days: int) -> date:
    """Add N business days (Mon-Fri) to a start date."""
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current

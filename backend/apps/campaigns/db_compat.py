"""Проверки схемы БД без жёсткой привязки к порядку миграций (устойчивость к пропущенным migrate)."""

from django.db import connection

from .models import Lead


def lead_table_has_quota_split_columns() -> bool:
    """Есть ли в таблице лидов колонки из миграции 0006 (квоты заявл./списочн.)."""
    table = Lead._meta.db_table
    try:
        with connection.cursor() as cursor:
            desc = connection.introspection.get_table_description(cursor, table)
    except Exception:
        return False
    names = {str(col.name).lower() for col in desc}
    return "demand_quota_list" in names and "demand_collected_declared" in names

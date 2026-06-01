"""Фиксированные колонки канбана задач (рабочее пространство)."""

from .models import LeadSubfunnel

TASK_WORKFLOW_COLUMNS = [
    {"status": LeadSubfunnel.Status.BACKLOG, "stage_name": "Бэклог", "order": 0},
    {"status": LeadSubfunnel.Status.IN_PROGRESS, "stage_name": "В работе", "order": 1},
    {"status": LeadSubfunnel.Status.PAUSED, "stage_name": "Пауза", "order": 2},
    {"status": LeadSubfunnel.Status.REJECTED, "stage_name": "Отказ", "order": 3},
    {"status": LeadSubfunnel.Status.DONE, "stage_name": "Готово", "order": 4},
]

TASK_WORKFLOW_STATUS_VALUES = {col["status"] for col in TASK_WORKFLOW_COLUMNS}

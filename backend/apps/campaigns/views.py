from django.utils import timezone
from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from django.db.utils import OperationalError, ProgrammingError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Campaign, CampaignQueue, CampaignProgram,
    CampaignRegion, CampaignOrganization,
    QueueStageDeadline, Lead, LeadChecklistValue, LeadChecklistAttachment,
    LeadInteraction,
    LeadActivityLog,
)
from .db_compat import lead_table_has_quota_split_columns
from .serializers import (
    CampaignListSerializer, CampaignDetailSerializer,
    CampaignCreateSerializer, CampaignQueueSerializer,
    CampaignProgramSerializer, CampaignRegionSerializer,
    CampaignOrganizationSerializer,
    QueueStageDeadlineSerializer,
    LeadListSerializer, LeadDetailSerializer,
    LeadChecklistValueSerializer, LeadInteractionSerializer,
)


def _log_lead_activity(lead, user, event_type, summary):
    if not summary:
        return
    try:
        LeadActivityLog.objects.create(
            lead=lead,
            event_type=event_type,
            summary=summary[:500],
            created_by=user if getattr(user, "is_authenticated", False) else None,
        )
    except (OperationalError, ProgrammingError):
        # Таблица ещё не создана (миграции не применены) — не блокируем основное действие
        pass


def _append_synthetic_checklist_from_values(lead, items):
    """Добавляет в ленту отметки по чек-листу из completed_at, если в журнале нет той же записи."""
    existing = set()
    for it in items:
        if it.get("kind") in ("checklist", "stage"):
            existing.add((it.get("summary", ""), (it.get("at") or "")[:19]))

    for cv in (
        lead.checklist_values.select_related("checklist_item", "completed_by")
        .filter(completed_at__isnull=False, is_completed=True)
    ):
        text = cv.checklist_item.text
        summary = f"Отмечен пункт «{text}»"
        at_str = cv.completed_at.isoformat()
        sig = (summary, at_str[:19])
        if sig in existing:
            continue
        existing.add(sig)
        u = cv.completed_by
        row = {
            "kind": "checklist",
            "id": 10_000_000 + cv.pk,
            "at": at_str,
            "summary": summary,
            "created_by_name": str(u) if u else None,
        }
        if cv.contact_id:
            row["contact_id"] = cv.contact_id
        items.append(row)


def _filter_timeline_items(items, kinds, contact_id):
    """Фильтр ?kind=interaction,stage&contact=12 — по контакту только события, где он указан."""
    if not kinds and contact_id is None:
        return items
    out = []
    for it in items:
        k = it.get("kind")
        if kinds and k not in kinds:
            continue
        if contact_id is not None:
            if k == "interaction":
                cid = (it.get("data") or {}).get("contact")
                if cid != contact_id:
                    continue
            elif k == "checklist":
                if it.get("contact_id") != contact_id:
                    continue
            else:
                continue
        out.append(it)
    return out


class CampaignViewSet(viewsets.ModelViewSet):
    filterset_fields = ["status", "federal_operator"]
    search_fields = ["name"]

    def get_queryset(self):
        qs = Campaign.objects.select_related(
            "federal_operator", "created_by"
        ).prefetch_related(
            "queues__stage_deadlines",
            "campaign_funnels__funnel",
            "campaign_programs__program__profession",
            "campaign_regions__region__federal_district",
            "campaign_regions__queue",
            "organizations__organization__region",
            "leads__organization__region",
            "leads__funnel",
            "leads__current_stage",
            "leads__queue",
            "leads__manager",
            "leads__primary_contact",
        )
        if self.action == "list":
            qs = qs.order_by("-created_at")
            # Без колонок 0006 annotate даёт SQL error → 500 на проде при пропущенном migrate
            if lead_table_has_quota_split_columns():
                qs = qs.annotate(
                    _d_plan=Coalesce(Sum("leads__forecast_demand"), Value(0)),
                    _d_cd=Coalesce(Sum("leads__demand_collected_declared"), Value(0)),
                    _d_cl=Coalesce(Sum("leads__demand_collected_list"), Value(0)),
                    _d_qd=Coalesce(Sum("leads__demand_quota_declared"), Value(0)),
                    _d_ql=Coalesce(Sum("leads__demand_quota_list"), Value(0)),
                )
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return CampaignListSerializer
        if self.action in ("create",):
            return CampaignCreateSerializer
        if self.action in ("update", "partial_update"):
            return CampaignCreateSerializer
        return CampaignDetailSerializer

    @action(detail=True, methods=["post"], url_path="programs")
    def add_programs(self, request, pk=None):
        campaign = self.get_object()
        program_ids = request.data.get("program_ids", [])
        created = []
        for pid in program_ids:
            obj, was_created = CampaignProgram.objects.get_or_create(
                campaign=campaign, program_id=pid,
                defaults={"manager_id": request.data.get("manager_id")},
            )
            if was_created:
                created.append(obj)
        return Response(
            CampaignProgramSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="regions")
    def add_regions(self, request, pk=None):
        campaign = self.get_object()
        regions_data = request.data.get("regions", [])
        created = []
        for rd in regions_data:
            obj, was_created = CampaignRegion.objects.get_or_create(
                campaign=campaign,
                region_id=rd["region_id"],
                defaults={
                    "queue_id": rd.get("queue_id"),
                    "manager_id": rd.get("manager_id"),
                },
            )
            if was_created:
                created.append(obj)
        return Response(
            CampaignRegionSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="organizations")
    def add_organizations(self, request, pk=None):
        campaign = self.get_object()
        org_ids = request.data.get("organization_ids", [])
        created = []
        for oid in org_ids:
            obj, was_created = CampaignOrganization.objects.get_or_create(
                campaign=campaign,
                organization_id=oid,
                defaults={"manager_id": request.data.get("manager_id")},
            )
            if was_created:
                created.append(obj)
        return Response(
            CampaignOrganizationSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="leads")
    def add_leads(self, request, pk=None):
        campaign = self.get_object()
        lead_data = request.data.get("leads", [])
        first_queue = campaign.queues.order_by("queue_number").first()
        created = []
        for ld in lead_data:
            queue_id = ld.get("queue_id") or (first_queue.id if first_queue else None)
            obj, was_created = Lead.objects.get_or_create(
                campaign=campaign,
                organization_id=ld["organization_id"],
                funnel_id=ld["funnel_id"],
                defaults={
                    "queue_id": queue_id,
                    "manager_id": ld.get("manager_id"),
                    "forecast_demand": ld.get("forecast_demand"),
                },
            )
            if was_created:
                created.append(obj)
        return Response(
            LeadListSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="assign-managers")
    def assign_managers(self, request, pk=None):
        campaign = self.get_object()
        assignments = request.data.get("assignments", [])
        updated = 0
        for a in assignments:
            level = a.get("level")
            target_id = a.get("target_id")
            manager_id = a.get("manager_id")

            if level == "program":
                CampaignProgram.objects.filter(
                    campaign=campaign, program_id=target_id
                ).update(manager_id=manager_id)
                updated += 1
            elif level == "region":
                CampaignRegion.objects.filter(
                    campaign=campaign, region_id=target_id
                ).update(manager_id=manager_id)
                updated += 1
            elif level == "organization":
                CampaignOrganization.objects.filter(
                    campaign=campaign, organization_id=target_id
                ).update(manager_id=manager_id)
                updated += 1
            elif level == "lead":
                Lead.objects.filter(
                    campaign=campaign, id=target_id
                ).update(manager_id=manager_id)
                updated += 1

        return Response({"updated": updated})


class CampaignQueueViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignQueueSerializer
    filterset_fields = ["campaign"]

    def get_queryset(self):
        return CampaignQueue.objects.all()

    @action(detail=True, methods=["get", "post"], url_path="stage-deadlines")
    def stage_deadlines(self, request, pk=None):
        queue = self.get_object()
        if request.method == "GET":
            deadlines = queue.stage_deadlines.select_related("funnel_stage")
            serializer = QueueStageDeadlineSerializer(deadlines, many=True)
            return Response(serializer.data)

        serializer = QueueStageDeadlineSerializer(
            data={**request.data, "queue": queue.pk}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CampaignOrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignOrganizationSerializer
    filterset_fields = ["campaign", "status", "manager"]

    def get_queryset(self):
        return CampaignOrganization.objects.select_related(
            "organization__region", "manager"
        )


class LeadViewSet(viewsets.ModelViewSet):
    filterset_fields = ["campaign", "funnel", "queue", "manager", "current_stage"]
    search_fields = ["organization__name"]

    def get_queryset(self):
        return Lead.objects.select_related(
            "organization__region", "funnel", "current_stage",
            "queue", "manager", "primary_contact",
        ).prefetch_related(
            "checklist_values__checklist_item",
            "checklist_values__attachments",
            "interactions",
        )

    def get_serializer_class(self):
        if self.action == "list":
            return LeadListSerializer
        return LeadDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.current_stage:
            self._ensure_checklist_values(instance, instance.current_stage)
            instance = self.get_queryset().get(pk=instance.pk)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="checklist")
    def checklist(self, request, pk=None):
        lead = self.get_object()
        if request.method == "GET":
            values = lead.checklist_values.select_related(
                "checklist_item"
            ).prefetch_related("attachments")
            serializer = LeadChecklistValueSerializer(
                values, many=True, context={"request": request}
            )
            return Response(serializer.data)

        data = {**request.data, "lead": lead.pk}
        if request.data.get("is_completed"):
            data["completed_at"] = timezone.now().isoformat()
            data["completed_by"] = request.user.pk
        serializer = LeadChecklistValueSerializer(data=data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="checklist/(?P<value_id>[^/.]+)/toggle")
    def toggle_checklist(self, request, pk=None, value_id=None):
        lead = self.get_object()
        try:
            value = lead.checklist_values.select_related("checklist_item").get(pk=value_id)
        except LeadChecklistValue.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        value.is_completed = not value.is_completed
        if value.is_completed:
            value.completed_at = timezone.now()
            value.completed_by = request.user
        else:
            value.completed_at = None
            value.completed_by = None
        value.save()
        item_text = value.checklist_item.text
        if value.is_completed:
            summary = f"Отмечен пункт «{item_text}»"
        else:
            summary = f"Снята отметка с пункта «{item_text}»"
        _log_lead_activity(lead, request.user, LeadActivityLog.EventType.CHECKLIST, summary)
        return Response(
            LeadChecklistValueSerializer(value, context={"request": request}).data
        )

    @action(detail=True, methods=["patch"], url_path="checklist/(?P<value_id>[^/.]+)/update")
    def update_checklist_value(self, request, pk=None, value_id=None):
        lead = self.get_object()
        try:
            value = lead.checklist_values.select_related("checklist_item").get(pk=value_id)
        except LeadChecklistValue.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        files_list = list(request.FILES.getlist("files"))
        if not files_list:
            files_list = list(request.FILES.getlist("file"))
        if not files_list:
            single = request.FILES.get("file") or request.FILES.get("file_value")
            if single:
                files_list = [single]
        files_added = False
        for f in files_list:
            order = value.attachments.count()
            LeadChecklistAttachment.objects.create(
                checklist_value=value, file=f, order=order
            )
            files_added = True

        updatable = [
            "text_value", "select_value",
            "contact_name", "contact_position", "contact_phone",
            "contact_email", "contact_messenger",
        ]
        field_labels = {
            "text_value": "текст",
            "select_value": "выбор",
            "contact_name": "ФИО",
            "contact_position": "должность",
            "contact_phone": "телефон",
            "contact_email": "email",
            "contact_messenger": "мессенджер",
        }
        old_snapshot = {f: getattr(value, f) for f in updatable}
        old_contact_id = value.contact_id
        for field in updatable:
            if field in request.data:
                setattr(value, field, request.data[field])
        if "contact" in request.data:
            cid = request.data["contact"]
            value.contact_id = int(cid) if cid is not None and cid != "" else None
        value.save()

        changed_labels = []
        if files_added:
            changed_labels.append("файл")
        for field in updatable:
            if field in request.data and old_snapshot[field] != getattr(value, field):
                changed_labels.append(field_labels.get(field, field))
        if "contact" in request.data:
            new_cid = value.contact_id
            if old_contact_id != new_cid:
                changed_labels.append("контакт из справочника")
        if changed_labels:
            item_text = value.checklist_item.text
            parts = ", ".join(sorted(set(changed_labels)))
            _log_lead_activity(
                lead,
                request.user,
                LeadActivityLog.EventType.CHECKLIST,
                f"«{item_text}»: {parts}",
            )
        return Response(
            LeadChecklistValueSerializer(value, context={"request": request}).data
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"checklist/(?P<value_id>[^/.]+)/attachments/(?P<attachment_id>[^/.]+)",
    )
    def delete_checklist_attachment(self, request, pk=None, value_id=None, attachment_id=None):
        lead = self.get_object()
        try:
            value = lead.checklist_values.select_related("checklist_item").get(pk=value_id)
        except LeadChecklistValue.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            att = value.attachments.get(pk=attachment_id)
        except LeadChecklistAttachment.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        item_text = value.checklist_item.text
        att.file.delete(save=False)
        att.delete()
        _log_lead_activity(
            lead,
            request.user,
            LeadActivityLog.EventType.CHECKLIST,
            f"«{item_text}»: удалён файл вложения",
        )
        value.refresh_from_db()
        return Response(
            LeadChecklistValueSerializer(value, context={"request": request}).data
        )

    @action(detail=True, methods=["get", "post"], url_path="interactions")
    def interactions(self, request, pk=None):
        lead = self.get_object()
        if request.method == "GET":
            interactions = lead.interactions.select_related("created_by")
            serializer = LeadInteractionSerializer(interactions, many=True)
            return Response(serializer.data)

        serializer = LeadInteractionSerializer(
            data={**request.data, "lead": lead.pk}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        """Единая лента: взаимодействия + смена стадий + чек-лист (по дате)."""
        lead = self.get_object()
        items = []
        for i in lead.interactions.select_related("created_by").order_by("-date", "-created_at"):
            dt = i.date or i.created_at
            at_str = dt.isoformat() if dt and hasattr(dt, "isoformat") else (str(dt) if dt else "")
            items.append({
                "kind": "interaction",
                "id": i.pk,
                "at": at_str,
                "data": LeadInteractionSerializer(i).data,
            })
        try:
            activity_qs = list(
                lead.activity_logs.select_related("created_by").all()
            )
        except (OperationalError, ProgrammingError):
            activity_qs = []
        for log in activity_qs:
            user = log.created_by
            items.append({
                "kind": log.event_type,
                "id": log.pk,
                "at": log.created_at.isoformat(),
                "summary": log.summary,
                "created_by_name": str(user) if user else None,
            })
        _append_synthetic_checklist_from_values(lead, items)
        items.sort(key=lambda x: x["at"] or "", reverse=True)

        kinds_raw = request.query_params.get("kind", "").strip()
        kinds = None
        if kinds_raw:
            kinds = {x.strip() for x in kinds_raw.split(",") if x.strip()}
        contact_param = request.query_params.get("contact")
        contact_id = None
        if contact_param not in (None, ""):
            try:
                contact_id = int(contact_param)
            except (TypeError, ValueError):
                contact_id = None
        items = _filter_timeline_items(items, kinds, contact_id)
        return Response(items)

    @action(detail=True, methods=["post"], url_path="advance-stage")
    def advance_stage(self, request, pk=None):
        lead = self.get_object()
        old_stage = lead.current_stage
        normal_stages = list(
            lead.funnel.stages.filter(is_rejection=False).order_by("order")
        )
        if not normal_stages:
            return Response({"detail": "No stages in funnel"}, status=status.HTTP_400_BAD_REQUEST)

        if lead.current_stage is None or lead.current_stage.is_rejection:
            lead.current_stage = normal_stages[0]
        else:
            current_idx = next(
                (i for i, s in enumerate(normal_stages) if s.id == lead.current_stage_id),
                -1,
            )
            if current_idx < len(normal_stages) - 1:
                lead.current_stage = normal_stages[current_idx + 1]
            else:
                return Response(
                    {"detail": "Already at last stage"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        lead.save(update_fields=["current_stage", "updated_at"])
        self._ensure_checklist_values(lead, lead.current_stage)
        old_name = old_stage.name if old_stage else "—"
        new_name = lead.current_stage.name if lead.current_stage else "—"
        _log_lead_activity(
            lead,
            request.user,
            LeadActivityLog.EventType.STAGE,
            f"{old_name} → {new_name}",
        )
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"], url_path="retreat-stage")
    def retreat_stage(self, request, pk=None):
        lead = self.get_object()
        normal_stages = list(
            lead.funnel.stages.filter(is_rejection=False).order_by("order")
        )
        if not normal_stages:
            return Response({"detail": "No stages in funnel"}, status=status.HTTP_400_BAD_REQUEST)

        if lead.current_stage is None or lead.current_stage.is_rejection:
            return Response(
                {"detail": "No current stage to retreat from"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_idx = next(
            (i for i, s in enumerate(normal_stages) if s.id == lead.current_stage_id),
            -1,
        )
        if current_idx <= 0:
            return Response(
                {"detail": "Already at first stage"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_stage = lead.current_stage
        lead.current_stage = normal_stages[current_idx - 1]
        lead.save(update_fields=["current_stage", "updated_at"])
        old_name = old_stage.name if old_stage else "—"
        new_name = lead.current_stage.name if lead.current_stage else "—"
        _log_lead_activity(
            lead,
            request.user,
            LeadActivityLog.EventType.STAGE,
            f"{old_name} → {new_name}",
        )
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        lead = self.get_object()
        rejection_stage = lead.funnel.stages.filter(is_rejection=True).first()
        if not rejection_stage:
            return Response(
                {"detail": "No rejection stage in funnel"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        old_stage = lead.current_stage
        lead.current_stage = rejection_stage
        lead.save(update_fields=["current_stage", "updated_at"])
        self._ensure_checklist_values(lead, lead.current_stage)
        old_name = old_stage.name if old_stage else "—"
        _log_lead_activity(
            lead,
            request.user,
            LeadActivityLog.EventType.STAGE,
            f"{old_name} → Отказ",
        )
        return Response(LeadDetailSerializer(lead).data)

    @staticmethod
    def _ensure_checklist_values(lead, stage):
        """Create LeadChecklistValue for each StageChecklistItem that doesn't have one yet."""
        if not stage:
            return
        for item in stage.checklist_items.all():
            LeadChecklistValue.objects.get_or_create(
                lead=lead, checklist_item=item,
            )

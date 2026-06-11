from apps.campaigns.models import Lead


ORG_PROJECT_MSG = "Организация участвует в проекте"
ORG_HISTORY_MSG = "Есть история взаимодействий"
ORG_LEAD_MSG = "Организация связана с лидами"

CONTACT_ORG_PROJECT_MSG = "Организация контакта участвует в проекте"
CONTACT_HISTORY_MSG = "Есть история взаимодействий"
CONTACT_LEAD_MSG = "Контакт связан с лидами"


def organization_deletion_blockers(org) -> list[str]:
    reasons: list[str] = []
    if _org_has_project_membership(org):
        reasons.append(ORG_PROJECT_MSG)
    if _org_has_interaction_history(org):
        reasons.append(ORG_HISTORY_MSG)
    if _org_has_leads(org):
        reasons.append(ORG_LEAD_MSG)
    return reasons


def contact_deletion_blockers(contact) -> list[str]:
    reasons: list[str] = []
    if _contact_org_in_project(contact):
        reasons.append(CONTACT_ORG_PROJECT_MSG)
    if _contact_has_interaction_history(contact):
        reasons.append(CONTACT_HISTORY_MSG)
    if _contact_has_lead_links(contact):
        reasons.append(CONTACT_LEAD_MSG)
    return reasons


def _org_has_project_membership(org) -> bool:
    cached = getattr(org, "_has_project_membership", None)
    if cached is not None:
        return bool(cached)
    return org.project_memberships.exists()


def _org_has_interaction_history(org) -> bool:
    cached = getattr(org, "_has_interaction_history", None)
    if cached is not None:
        return bool(cached)
    return org.interactions.exists()


def _org_has_leads(org) -> bool:
    cached = getattr(org, "_has_leads", None)
    if cached is not None:
        return bool(cached)
    return Lead.objects.filter(organization=org).exists()


def _contact_org_in_project(contact) -> bool:
    cached = getattr(contact, "_org_has_project_membership", None)
    if cached is not None:
        return bool(cached)
    return contact.organization.project_memberships.exists()


def _contact_has_interaction_history(contact) -> bool:
    cached = getattr(contact, "_has_interaction_history", None)
    if cached is not None:
        return bool(cached)
    return contact.lead_interactions.exists()


def _contact_has_lead_links(contact) -> bool:
    cached = getattr(contact, "_has_lead_links", None)
    if cached is not None:
        return bool(cached)
    return (
        contact.primary_for_leads.exists()
        or contact.checklist_values.exists()
    )

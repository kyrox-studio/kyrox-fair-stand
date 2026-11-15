"""Check project assignment references against CRM's scoped read API."""

from collections.abc import Callable
from typing import Literal
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.config import get_settings
from app.integrations.kyrox_core.auth import AuthContext
from app.modules.fair_stand.api.dependencies import bearer_scheme, get_auth_context

ReferenceKind = Literal["customers", "fairs"]
ReferenceValidator = Callable[[ReferenceKind, UUID], None]


def validate_crm_reference(
    client: httpx.Client, kind: ReferenceKind, reference_id: UUID, organization_id: UUID,
) -> None:
    unavailable = "CRM reference validation unavailable"
    invalid = "Customer or fair is not available to this organization"
    try:
        response = client.get(f"/api/v1/{kind}/{reference_id}")
        if response.status_code in (403, 404):
            raise HTTPException(422, invalid)
        response.raise_for_status()
        record = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, unavailable) from exc
    if not isinstance(record, dict) or not {"id", "organization_id", "deleted_at"} <= record.keys():
        raise HTTPException(503, unavailable)
    own = record["organization_id"] == str(organization_id)
    system_fair = kind == "fairs" and record.get("origin") == "system" and record["organization_id"] is None
    removed = record["deleted_at"] is not None or record.get("status") == "deleted"
    if record["id"] != str(reference_id) or removed or not (own or system_fair):
        raise HTTPException(422, invalid)


def get_crm_reference_validator(
    auth: AuthContext = Depends(get_auth_context),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> ReferenceValidator:
    def validate(kind: ReferenceKind, reference_id: UUID) -> None:
        if credentials is None or not credentials.credentials:
            raise HTTPException(401, "Not authenticated")
        with httpx.Client(
            base_url=get_settings().fair_crm_base_url,
            headers={
                "Authorization": f"Bearer {credentials.credentials}",
                "X-Organization-Id": str(auth.organization_id),
            },
            timeout=5.0,
            trust_env=False,
        ) as client:
            validate_crm_reference(client, kind, reference_id, auth.organization_id)

    return validate

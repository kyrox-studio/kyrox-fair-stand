"""Organization group template HTTP API (sahne editörü Faz 5).

Permissions reuse the project permissions (user decision): read lists and places,
create or update saves and renames, delete removes. The organization comes from the
auth context only; another organization's template is a 404.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field

from app.integrations.kyrox_core.auth import AuthContext
from app.modules.fair_stand.api.dependencies import (
    PERMISSION_PROJECTS_CREATE,
    PERMISSION_PROJECTS_DELETE,
    PERMISSION_PROJECTS_READ,
    PERMISSION_PROJECTS_UPDATE,
    get_group_template_service,
    require_any_permission,
    require_permission,
)
from app.modules.fair_stand.application.group_templates import (
    GroupTemplateService,
    GroupTemplateServiceError,
    GroupTemplateView,
)

router = APIRouter(prefix="/fair-stand/group-templates", tags=["fair-stand-group-templates"])


class GroupTemplateCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    payload: dict[str, Any]


class GroupTemplateRenameBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)


def _raise(exc: GroupTemplateServiceError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


def _ms(value) -> int:
    return int(value.timestamp() * 1000)


def _summary_json(template: GroupTemplateView) -> dict[str, Any]:
    return {
        "id": str(template.id),
        "organizationId": str(template.organization_id),
        "name": template.name,
        "memberCount": template.member_count,
        "createdAt": _ms(template.created_at),
        "updatedAt": _ms(template.updated_at),
    }


def _detail_json(template: GroupTemplateView) -> dict[str, Any]:
    return {**_summary_json(template), "payload": template.payload}


@router.get("")
def list_group_templates(
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_READ)),
    service: GroupTemplateService = Depends(get_group_template_service),
) -> dict[str, Any]:
    return {"templates": [_summary_json(item) for item in service.list_templates(auth.organization_id)]}


@router.get("/{template_id}")
def get_group_template(
    template_id: UUID,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_READ)),
    service: GroupTemplateService = Depends(get_group_template_service),
) -> dict[str, Any]:
    try:
        return _detail_json(service.get_template(template_id, auth.organization_id))
    except GroupTemplateServiceError as exc:
        _raise(exc)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_group_template(
    body: GroupTemplateCreateBody,
    auth: AuthContext = Depends(require_any_permission(PERMISSION_PROJECTS_CREATE, PERMISSION_PROJECTS_UPDATE)),
    service: GroupTemplateService = Depends(get_group_template_service),
) -> dict[str, Any]:
    try:
        template = service.create_template(
            organization_id=auth.organization_id,
            user_id=auth.user_id,
            name=body.name,
            payload=body.payload,
        )
    except GroupTemplateServiceError as exc:
        _raise(exc)
    return _detail_json(template)


@router.patch("/{template_id}")
def rename_group_template(
    template_id: UUID,
    body: GroupTemplateRenameBody,
    auth: AuthContext = Depends(require_any_permission(PERMISSION_PROJECTS_CREATE, PERMISSION_PROJECTS_UPDATE)),
    service: GroupTemplateService = Depends(get_group_template_service),
) -> dict[str, Any]:
    try:
        return _summary_json(service.rename_template(template_id, auth.organization_id, body.name))
    except GroupTemplateServiceError as exc:
        _raise(exc)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group_template(
    template_id: UUID,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_DELETE)),
    service: GroupTemplateService = Depends(get_group_template_service),
) -> Response:
    try:
        service.delete_template(template_id, auth.organization_id)
    except GroupTemplateServiceError as exc:
        _raise(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

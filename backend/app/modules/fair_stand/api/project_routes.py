"""Fair Stand project SoT HTTP API."""

from __future__ import annotations

from typing import Any, Literal
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field

from app.integrations.kyrox_core.auth import AuthContext
from app.integrations.kyrox_core.dev_bypass import dev_bypass_enabled
from app.integrations.kyrox_core.ports import AuthorizationPort
from app.modules.fair_stand.api.dependencies import (
    PERMISSION_PROJECTS_CREATE,
    PERMISSION_PROJECTS_DELETE,
    PERMISSION_PROJECTS_EXECUTE,
    PERMISSION_PROJECTS_READ,
    PERMISSION_PROJECTS_UPDATE,
    bearer_scheme,
    get_authorization_adapter,
    get_auth_context,
    get_project_service,
    require_permission,
)
from app.modules.fair_stand.application.image_optimize import upload_limit_message
from app.modules.fair_stand.application.projects import (
    AssetView,
    ProjectDetail,
    ProjectService,
    ProjectServiceError,
    ProjectSummary,
    RevisionDetail,
    RevisionSummary,
)

router = APIRouter(prefix="/fair-stand/projects", tags=["fair-stand-projects"])


def content_disposition(disposition: str, filename: str) -> str:
    """Build ASCII-safe Content-Disposition with RFC 5987 UTF-8 filename*."""
    raw = (filename or "file").replace("\r", "").replace("\n", "")
    ascii_name = "".join(ch if 32 <= ord(ch) < 127 and ch not in '"\\' else "_" for ch in raw)
    ascii_name = ascii_name.strip("._") or "file"
    return f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(raw)}"


class ProjectPayloadBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stand: dict[str, Any] | None = None
    modules: list[Any] = Field(default_factory=list)


class ProjectCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    id: UUID | None = None
    name: str = Field(min_length=1, max_length=256)
    version: int = Field(default=1, ge=1)
    customer_id: UUID = Field(alias="customerId")
    payload: ProjectPayloadBody = Field(default_factory=ProjectPayloadBody)


class ProjectUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    name: str | None = Field(default=None, min_length=1, max_length=256)
    version: int | None = Field(default=None, ge=1)
    customer_id: UUID | None = Field(default=None, alias="customerId")
    payload: ProjectPayloadBody | None = None
    revision_mode: Literal["none", "create", "update"] = Field(default="none", alias="revisionMode")
    revision_number: int | None = Field(default=None, alias="revisionNumber", ge=1)


class ProjectCustomerBody(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    customer_id: UUID = Field(alias="customerId")


def _raise_service(exc: ProjectServiceError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


UPLOAD_READ_CHUNK_BYTES = 64 * 1024


async def read_upload_limited(file: UploadFile, *, max_bytes: int) -> bytes:
    """Read an upload in chunks, stopping as soon as ``max_bytes`` is exceeded.

    At most ``max_bytes + 1`` bytes are ever read into memory; the error matches the
    existing byte-limit contract of ``optimize_uploaded_image`` (HTTP 400).
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(min(UPLOAD_READ_CHUNK_BYTES, max_bytes + 1 - total))
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=upload_limit_message(max_bytes))
        chunks.append(chunk)
    return b"".join(chunks)


def _ms(dt) -> int:
    return int(dt.timestamp() * 1000)


def _asset_json(asset: AssetView) -> dict[str, Any]:
    return {
        "id": str(asset.id),
        "name": asset.name,
        "type": asset.mime_type,
        "byteSize": asset.byte_size,
        "storageKey": asset.storage_key,
        "createdAt": _ms(asset.created_at),
    }


def _summary_json(project: ProjectSummary) -> dict[str, Any]:
    return {
        "id": str(project.id),
        "organizationId": str(project.organization_id),
        "name": project.name,
        "customerId": str(project.customer_id),
        "version": project.version,
        "createdAt": _ms(project.created_at),
        "updatedAt": _ms(project.updated_at),
    }


def _revision_json(revision: RevisionSummary) -> dict[str, Any]:
    return {
        "revisionNumber": revision.revision_number,
        "createdAt": _ms(revision.created_at),
        "updatedAt": _ms(revision.updated_at),
    }


def _detail_json(project: ProjectDetail) -> dict[str, Any]:
    return {
        **_summary_json(project),
        "createdBy": str(project.created_by) if project.created_by else None,
        "payload": project.payload,
        "stand": project.payload.get("stand"),
        "modules": project.payload.get("modules") or [],
        "assets": [_asset_json(asset) for asset in project.assets],
        "revisions": [_revision_json(revision) for revision in project.revisions],
    }


def _revision_detail_json(revision: RevisionDetail) -> dict[str, Any]:
    return {
        **_revision_json(revision),
        "payload": revision.payload,
        "stand": revision.payload.get("stand"),
        "modules": revision.payload.get("modules") or [],
    }


@router.get("")
def list_projects(
    customer_id: UUID | None = Query(default=None, alias="customerId"),
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_READ)),
    service: ProjectService = Depends(get_project_service),
) -> dict[str, Any]:
    projects = service.list_projects(auth.organization_id, customer_id=customer_id)
    return {"projects": [_summary_json(project) for project in projects]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_CREATE)),
    service: ProjectService = Depends(get_project_service),
) -> dict[str, Any]:
    try:
        project = service.create_project(
            organization_id=auth.organization_id,
            user_id=auth.user_id,
            name=body.name,
            customer_id=body.customer_id,
            payload=body.payload.model_dump(),
            project_id=body.id,
            version=body.version,
        )
    except ProjectServiceError as exc:
        _raise_service(exc)
    return _detail_json(project)


@router.get("/{project_id}")
def get_project(
    project_id: UUID,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_READ)),
    service: ProjectService = Depends(get_project_service),
) -> dict[str, Any]:
    project = service.get_project(project_id, auth.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return _detail_json(project)


@router.put("/{project_id}")
def update_project(
    project_id: UUID,
    body: ProjectUpdateBody,
    auth: AuthContext = Depends(get_auth_context),
    authorization: AuthorizationPort = Depends(get_authorization_adapter),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    service: ProjectService = Depends(get_project_service),
) -> dict[str, Any]:
    # Upsert: first save / ZIP import uses PUT with a client-generated id.
    # Existing row requires update; missing row requires create.
    existing = service.get_project(project_id, auth.organization_id)
    needed = PERMISSION_PROJECTS_CREATE if existing is None else PERMISSION_PROJECTS_UPDATE
    if not dev_bypass_enabled():
        if credentials is None or not credentials.credentials:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        if not authorization.check_permission(
            organization_id=auth.organization_id,
            user_id=auth.user_id,
            permission_code=needed,
            access_token=credentials.credentials,
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    try:
        project = service.update_project(
            project_id=project_id,
            organization_id=auth.organization_id,
            name=body.name,
            payload=None if body.payload is None else body.payload.model_dump(),
            version=body.version,
            customer_id=body.customer_id,
            user_id=auth.user_id,
            create_if_missing=True,
            revision_mode=body.revision_mode,
            revision_number=body.revision_number,
        )
    except ProjectServiceError as exc:
        _raise_service(exc)
    return _detail_json(project)


@router.get("/{project_id}/revisions/{revision_number}")
def get_project_revision(
    project_id: UUID,
    revision_number: int,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_READ)),
    service: ProjectService = Depends(get_project_service),
) -> dict[str, Any]:
    revision = service.get_revision(project_id, auth.organization_id, revision_number)
    if revision is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found")
    return _revision_detail_json(revision)


@router.patch("/{project_id}/customer")
def assign_project_customer(
    project_id: UUID,
    body: ProjectCustomerBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_UPDATE)),
    service: ProjectService = Depends(get_project_service),
) -> dict[str, Any]:
    try:
        project = service.assign_customer(
            project_id=project_id,
            organization_id=auth.organization_id,
            customer_id=body.customer_id,
        )
    except ProjectServiceError as exc:
        _raise_service(exc)
    return _detail_json(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_DELETE)),
    service: ProjectService = Depends(get_project_service),
) -> Response:
    try:
        service.delete_project(project_id=project_id, organization_id=auth.organization_id)
    except ProjectServiceError as exc:
        _raise_service(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/assets", status_code=status.HTTP_201_CREATED)
async def upload_project_asset(
    project_id: UUID,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_UPDATE)),
    service: ProjectService = Depends(get_project_service),
    file: UploadFile = File(...),
    asset_id: UUID | None = Form(default=None),
    name: str | None = Form(default=None),
) -> dict[str, Any]:
    max_bytes = await run_in_threadpool(service.max_upload_bytes)
    raw = await read_upload_limited(file, max_bytes=max_bytes)
    try:
        # Pillow decode/encode is CPU-bound: keep it off the event loop.
        asset = await run_in_threadpool(
            service.upsert_asset,
            project_id=project_id,
            organization_id=auth.organization_id,
            raw=raw,
            content_type=file.content_type,
            name=name or file.filename or "image",
            asset_id=asset_id,
        )
    except ProjectServiceError as exc:
        _raise_service(exc)
    return _asset_json(asset)


@router.get("/{project_id}/assets/{asset_id}")
def download_project_asset(
    project_id: UUID,
    asset_id: UUID,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_READ)),
    service: ProjectService = Depends(get_project_service),
) -> Response:
    try:
        asset, content = service.get_asset_bytes(
            project_id=project_id,
            organization_id=auth.organization_id,
            asset_id=asset_id,
        )
    except ProjectServiceError as exc:
        _raise_service(exc)
    return Response(
        content=content,
        media_type=asset.mime_type,
        headers={"Content-Disposition": content_disposition("inline", asset.name)},
    )


@router.delete("/{project_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_asset(
    project_id: UUID,
    asset_id: UUID,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_UPDATE)),
    service: ProjectService = Depends(get_project_service),
) -> Response:
    try:
        service.delete_asset(
            project_id=project_id,
            organization_id=auth.organization_id,
            asset_id=asset_id,
        )
    except ProjectServiceError as exc:
        _raise_service(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/export")
def export_project_zip(
    project_id: UUID,
    auth: AuthContext = Depends(require_permission(PERMISSION_PROJECTS_EXECUTE)),
    service: ProjectService = Depends(get_project_service),
) -> Response:
    try:
        filename, content = service.build_export_zip(
            project_id=project_id,
            organization_id=auth.organization_id,
        )
    except ProjectServiceError as exc:
        _raise_service(exc)
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": content_disposition("attachment", filename)},
    )

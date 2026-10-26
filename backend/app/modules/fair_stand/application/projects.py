"""Fair Stand project SoT: CRUD, assets, export zip."""

from __future__ import annotations

import io
import json
import zipfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.modules.fair_stand.application.image_optimize import (
    ImageOptimizeError,
    build_storage_key,
    optimize_uploaded_image,
)
from app.modules.fair_stand.infrastructure.asset_storage import (
    delete_asset_file,
    delete_project_asset_tree,
    read_asset_bytes,
    write_asset_bytes,
)
from app.modules.fair_stand.infrastructure.models import (
    FairStandProjectAssetModel,
    FairStandProjectModel,
    FairStandProjectRevisionModel,
    FairStandSettingsModel,
)

# Physical rows kept per project. Revision numbers themselves are never reused.
REVISION_RETENTION_COUNT = 3
from app.modules.fair_stand.infrastructure.runtime_settings_seed import MAX_IMAGE_UPLOAD_MB


# Existing rows are backfilled with this id. It is not a crm_customers row.
UNASSIGNED_PROJECT_CUSTOMER_ID = UUID("00000000-0000-4000-8000-000000000001")


def backfill_unassigned_project_customers(connection) -> None:
    connection.execute(
        text(
            "UPDATE fair_stand_projects SET customer_id = :customer_id "
            "WHERE customer_id IS NULL"
        ),
        {"customer_id": str(UNASSIGNED_PROJECT_CUSTOMER_ID)},
    )


class ProjectServiceError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class AssetView:
    id: UUID
    name: str
    mime_type: str
    byte_size: int
    storage_key: str
    created_at: datetime


@dataclass(frozen=True)
class ProjectSummary:
    id: UUID
    organization_id: UUID
    customer_id: UUID
    name: str
    version: int
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class RevisionSummary:
    revision_number: int
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class RevisionDetail(RevisionSummary):
    payload: dict[str, Any]


@dataclass(frozen=True)
class ProjectDetail(ProjectSummary):
    payload: dict[str, Any]
    created_by: UUID | None
    assets: list[AssetView]
    revisions: list[RevisionSummary] = field(default_factory=list)


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _asset_view(row: FairStandProjectAssetModel) -> AssetView:
    return AssetView(
        id=row.id,
        name=row.name,
        mime_type=row.mime_type,
        byte_size=row.byte_size,
        storage_key=row.storage_key,
        created_at=row.created_at,
    )


def _summary(row: FairStandProjectModel) -> ProjectSummary:
    return ProjectSummary(
        id=row.id,
        organization_id=row.organization_id,
        customer_id=row.customer_id,
        name=row.name,
        version=row.version,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _detail(
    row: FairStandProjectModel,
    revisions: list[RevisionSummary] | None = None,
) -> ProjectDetail:
    return ProjectDetail(
        id=row.id,
        organization_id=row.organization_id,
        customer_id=row.customer_id,
        name=row.name,
        version=row.version,
        created_at=row.created_at,
        updated_at=row.updated_at,
        payload=dict(row.payload or {}),
        created_by=row.created_by,
        assets=[_asset_view(asset) for asset in row.assets],
        revisions=list(revisions or []),
    )


def _normalize_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    body = dict(payload or {})
    stand = body.get("stand")
    modules = body.get("modules")
    if stand is not None and not isinstance(stand, dict):
        raise ProjectServiceError("payload.stand must be an object")
    if modules is None:
        modules = []
    if not isinstance(modules, list):
        raise ProjectServiceError("payload.modules must be an array")
    return {"stand": stand, "modules": modules}


class ProjectService:
    def __init__(self, session: Session, *, asset_root: Path) -> None:
        self._session = session
        self._asset_root = asset_root

    def max_upload_bytes(self) -> int:
        """Effective per-file image upload byte limit (``max_image_upload_mb`` setting)."""
        row = self._session.get(FairStandSettingsModel, 1)
        mb = row.max_image_upload_mb if row is not None else MAX_IMAGE_UPLOAD_MB
        return int(mb) * 1024 * 1024

    def _project_statement(self, project_id: UUID, organization_id: UUID):
        return (
            select(FairStandProjectModel)
            .where(
                FairStandProjectModel.id == project_id,
                FairStandProjectModel.organization_id == organization_id,
            )
            .options(selectinload(FairStandProjectModel.assets))
        )

    def _get_org_project(self, project_id: UUID, organization_id: UUID) -> FairStandProjectModel | None:
        return self._session.scalar(self._project_statement(project_id, organization_id))

    def _lock_org_project(self, project_id: UUID, organization_id: UUID) -> FairStandProjectModel | None:
        statement = self._project_statement(project_id, organization_id)
        bind = self._session.get_bind()
        # SQLite ignores row locks. Production PostgreSQL must take the parent
        # row lock before MAX(revision_number) is read.
        if bind is not None and bind.dialect.name == "postgresql":
            statement = statement.with_for_update()
        return self._session.scalar(statement)

    def _revision_summaries(self, project_id: UUID) -> list[RevisionSummary]:
        rows = self._session.scalars(
            select(FairStandProjectRevisionModel)
            .where(FairStandProjectRevisionModel.project_id == project_id)
            .order_by(FairStandProjectRevisionModel.revision_number.desc())
        ).all()
        return [
            RevisionSummary(
                revision_number=row.revision_number,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ]

    def _project_detail(self, row: FairStandProjectModel) -> ProjectDetail:
        return _detail(row, self._revision_summaries(row.id))

    def _max_revision_number(self, project_id: UUID) -> int:
        value = self._session.scalar(
            select(func.max(FairStandProjectRevisionModel.revision_number)).where(
                FairStandProjectRevisionModel.project_id == project_id,
            )
        )
        return int(value or 0)

    def _prune_revisions(self, project_id: UUID) -> None:
        rows = self._session.scalars(
            select(FairStandProjectRevisionModel)
            .where(FairStandProjectRevisionModel.project_id == project_id)
            .order_by(FairStandProjectRevisionModel.revision_number.desc())
        ).all()
        for stale in rows[REVISION_RETENTION_COUNT:]:
            self._session.delete(stale)

    def _apply_revision(
        self,
        row: FairStandProjectModel,
        revision_mode: str,
        revision_number: int | None,
    ) -> None:
        if revision_mode == "none":
            return
        if revision_mode not in {"create", "update"}:
            raise ProjectServiceError("revisionMode must be none, create, or update")

        payload = dict(row.payload or {})
        now = _now()
        if revision_mode == "update":
            current_max = self._max_revision_number(row.id)
            if revision_number is None or revision_number != current_max:
                raise ProjectServiceError(
                    "Only the current session revision can be updated",
                    status_code=409,
                )
            revision = self._session.scalar(
                select(FairStandProjectRevisionModel).where(
                    FairStandProjectRevisionModel.project_id == row.id,
                    FairStandProjectRevisionModel.revision_number == revision_number,
                )
            )
            if revision is None:
                raise ProjectServiceError(
                    "Only the current session revision can be updated",
                    status_code=409,
                )
            revision.payload = payload
            revision.updated_at = now
            return

        next_number = self._max_revision_number(row.id) + 1
        self._session.add(
            FairStandProjectRevisionModel(
                id=uuid4(),
                project_id=row.id,
                revision_number=next_number,
                payload=payload,
                created_at=now,
                updated_at=now,
            )
        )
        try:
            self._session.flush()
        except IntegrityError as exc:
            self._session.rollback()
            raise ProjectServiceError("Revision number conflict", status_code=409) from exc
        self._prune_revisions(row.id)

    def list_projects(
        self,
        organization_id: UUID,
        *,
        customer_id: UUID | None = None,
    ) -> list[ProjectSummary]:
        statement = select(FairStandProjectModel).where(
            FairStandProjectModel.organization_id == organization_id,
        )
        if customer_id is not None:
            statement = statement.where(FairStandProjectModel.customer_id == customer_id)
        rows = self._session.scalars(
            statement.order_by(FairStandProjectModel.updated_at.desc())
        ).all()
        return [_summary(row) for row in rows]

    def get_project(self, project_id: UUID, organization_id: UUID) -> ProjectDetail | None:
        row = self._get_org_project(project_id, organization_id)
        return self._project_detail(row) if row is not None else None

    def create_project(
        self,
        *,
        organization_id: UUID,
        user_id: UUID | None,
        name: str,
        customer_id: UUID | None,
        payload: dict[str, Any] | None = None,
        project_id: UUID | None = None,
        version: int = 1,
    ) -> ProjectDetail:
        cleaned_name = (name or "").strip()
        if not cleaned_name:
            raise ProjectServiceError("Project name is required")
        if customer_id is None:
            raise ProjectServiceError("customerId is required")
        now = _now()
        row = FairStandProjectModel(
            id=project_id or uuid4(),
            organization_id=organization_id,
            customer_id=customer_id,
            name=cleaned_name[:256],
            version=max(1, int(version or 1)),
            payload=_normalize_payload(payload),
            created_by=user_id,
            created_at=now,
            updated_at=now,
        )
        self._session.add(row)
        self._session.flush()
        self._session.refresh(row)
        return self._project_detail(row)

    def update_project(
        self,
        *,
        project_id: UUID,
        organization_id: UUID,
        name: str | None = None,
        payload: dict[str, Any] | None = None,
        version: int | None = None,
        customer_id: UUID | None = None,
        user_id: UUID | None = None,
        create_if_missing: bool = True,
        revision_mode: str = "none",
        revision_number: int | None = None,
    ) -> ProjectDetail:
        row = self._lock_org_project(project_id, organization_id)
        if row is None:
            if self._session.get(FairStandProjectModel, project_id) is not None:
                raise ProjectServiceError("Project not found", status_code=404)
            if not create_if_missing:
                raise ProjectServiceError("Project not found", status_code=404)
            self.create_project(
                organization_id=organization_id,
                user_id=user_id,
                name=(name or "Adsız Proje"),
                customer_id=customer_id,
                payload=payload,
                project_id=project_id,
                version=version or 1,
            )
            row = self._lock_org_project(project_id, organization_id)
            if row is None:
                raise ProjectServiceError("Project not found", status_code=404)
        else:
            if name is not None:
                cleaned = name.strip()
                if not cleaned:
                    raise ProjectServiceError("Project name is required")
                row.name = cleaned[:256]
            if version is not None:
                row.version = max(1, int(version))
            # Reject a historical overwrite before the live payload changes.
            if revision_mode == "update":
                current_max = self._max_revision_number(row.id)
                if revision_number is None or revision_number != current_max:
                    raise ProjectServiceError(
                        "Only the current session revision can be updated",
                        status_code=409,
                    )
            if payload is not None:
                row.payload = _normalize_payload(payload)
        row.updated_at = _now()
        self._apply_revision(row, revision_mode, revision_number)
        self._session.flush()
        self._session.refresh(row)
        return self._project_detail(row)

    def assign_customer(
        self,
        *,
        project_id: UUID,
        organization_id: UUID,
        customer_id: UUID | None,
    ) -> ProjectDetail:
        if customer_id is None:
            raise ProjectServiceError("customerId is required")
        row = self._get_org_project(project_id, organization_id)
        if row is None:
            raise ProjectServiceError("Project not found", status_code=404)
        row.customer_id = customer_id
        row.updated_at = _now()
        self._session.flush()
        self._session.refresh(row)
        return self._project_detail(row)

    def get_revision(
        self,
        project_id: UUID,
        organization_id: UUID,
        revision_number: int,
    ) -> RevisionDetail | None:
        project = self._get_org_project(project_id, organization_id)
        if project is None:
            return None
        row = self._session.scalar(
            select(FairStandProjectRevisionModel).where(
                FairStandProjectRevisionModel.project_id == project_id,
                FairStandProjectRevisionModel.revision_number == revision_number,
            )
        )
        if row is None:
            return None
        return RevisionDetail(
            revision_number=row.revision_number,
            created_at=row.created_at,
            updated_at=row.updated_at,
            payload=dict(row.payload or {}),
        )

    def delete_project(self, *, project_id: UUID, organization_id: UUID) -> None:
        row = self._get_org_project(project_id, organization_id)
        if row is None:
            raise ProjectServiceError("Project not found", status_code=404)
        self._session.delete(row)
        self._session.flush()
        delete_project_asset_tree(self._asset_root, organization_id, project_id)

    def upsert_asset(
        self,
        *,
        project_id: UUID,
        organization_id: UUID,
        raw: bytes,
        content_type: str | None,
        name: str,
        asset_id: UUID | None = None,
    ) -> AssetView:
        project = self._get_org_project(project_id, organization_id)
        if project is None:
            raise ProjectServiceError("Project not found", status_code=404)

        try:
            optimized = optimize_uploaded_image(
                raw,
                content_type=content_type,
                max_upload_bytes=self.max_upload_bytes(),
            )
        except ImageOptimizeError as exc:
            raise ProjectServiceError(str(exc)) from exc

        resolved_id = asset_id or uuid4()
        storage_key = build_storage_key(
            organization_id=organization_id,
            project_id=project_id,
            asset_id=resolved_id,
            extension=optimized.extension,
        )

        existing = self._session.get(FairStandProjectAssetModel, resolved_id)
        if existing is not None:
            if existing.organization_id != organization_id or existing.project_id != project_id:
                raise ProjectServiceError("Asset not found", status_code=404)
            if existing.storage_key != storage_key:
                delete_asset_file(self._asset_root, existing.storage_key)
            existing.name = (name or existing.name or "image")[:512]
            existing.mime_type = optimized.mime_type
            existing.byte_size = len(optimized.content)
            existing.storage_key = storage_key
            write_asset_bytes(self._asset_root, storage_key, optimized.content)
            project.updated_at = _now()
            self._session.flush()
            return _asset_view(existing)

        write_asset_bytes(self._asset_root, storage_key, optimized.content)
        row = FairStandProjectAssetModel(
            id=resolved_id,
            organization_id=organization_id,
            project_id=project_id,
            name=(name or "image")[:512],
            mime_type=optimized.mime_type,
            byte_size=len(optimized.content),
            storage_key=storage_key,
            created_at=_now(),
        )
        self._session.add(row)
        project.updated_at = _now()
        self._session.flush()
        return _asset_view(row)

    def get_asset_bytes(
        self,
        *,
        project_id: UUID,
        organization_id: UUID,
        asset_id: UUID,
    ) -> tuple[AssetView, bytes]:
        project = self._get_org_project(project_id, organization_id)
        if project is None:
            raise ProjectServiceError("Project not found", status_code=404)
        asset = next((item for item in project.assets if item.id == asset_id), None)
        if asset is None:
            raise ProjectServiceError("Asset not found", status_code=404)
        try:
            content = read_asset_bytes(self._asset_root, asset.storage_key)
        except FileNotFoundError as exc:
            raise ProjectServiceError("Asset file missing", status_code=404) from exc
        return _asset_view(asset), content

    def delete_asset(
        self,
        *,
        project_id: UUID,
        organization_id: UUID,
        asset_id: UUID,
    ) -> None:
        project = self._get_org_project(project_id, organization_id)
        if project is None:
            raise ProjectServiceError("Project not found", status_code=404)
        asset = next((item for item in project.assets if item.id == asset_id), None)
        if asset is None:
            raise ProjectServiceError("Asset not found", status_code=404)
        storage_key = asset.storage_key
        self._session.delete(asset)
        project.updated_at = _now()
        self._session.flush()
        delete_asset_file(self._asset_root, storage_key)

    def build_export_zip(self, *, project_id: UUID, organization_id: UUID) -> tuple[str, bytes]:
        project = self._get_org_project(project_id, organization_id)
        if project is None:
            raise ProjectServiceError("Project not found", status_code=404)

        manifest_assets: list[dict[str, Any]] = []
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            for asset in project.assets:
                ext = Path(asset.storage_key).suffix or ""
                path = f"assets/{asset.id}{ext}"
                try:
                    content = read_asset_bytes(self._asset_root, asset.storage_key)
                except FileNotFoundError as exc:
                    raise ProjectServiceError(
                        f"Asset file missing: {asset.id}",
                        status_code=404,
                    ) from exc
                archive.writestr(path, content)
                manifest_assets.append(
                    {
                        "id": str(asset.id),
                        "name": asset.name,
                        "type": asset.mime_type,
                        "createdAt": int(asset.created_at.timestamp() * 1000),
                        "path": path,
                    }
                )

            project_body = {
                "id": str(project.id),
                "name": project.name,
                "version": project.version,
                "createdAt": int(project.created_at.timestamp() * 1000),
                "updatedAt": int(project.updated_at.timestamp() * 1000),
                **dict(project.payload or {}),
            }

            archive.writestr(
                "project.json",
                json.dumps(
                    {
                        "archiveVersion": 1,
                        "exportedAt": int(_now().timestamp() * 1000),
                        "project": project_body,
                        "assets": manifest_assets,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
            )

        safe_name = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in project.name).strip("_")
        filename = f"{safe_name or 'stand-project'}.zip"
        return filename, buffer.getvalue()

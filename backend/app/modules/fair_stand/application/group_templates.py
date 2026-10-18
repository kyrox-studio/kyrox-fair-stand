"""Organization group templates (sahne editörü Faz 5).

A template is a group's parts and their relative layout for one organization. It is
not an Item: it has no BOM, unit or price of its own. Placing it in a project expands
it into normal modules (each an Item) and a new group, so BOM and cost come from the
parts as today. Images are not stored; project image assets are per project.

The organization always comes from the authenticated context, never from the body.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.fair_stand.infrastructure.models import FairStandGroupTemplateModel, FairStandItemModel

TEMPLATE_PAYLOAD_VERSION = 1
TEMPLATE_NAME_MAX_LENGTH = 80
TEMPLATE_MIN_MEMBERS = 2
TEMPLATE_MAX_MEMBERS = 200
TEMPLATE_MAX_PAYLOAD_BYTES = 512 * 1024
_IMAGE_REFERENCE_KEYS = frozenset({"imageAssetId", "fabricImageAssetId"})
_FORBIDDEN_MEMBER_KEYS = frozenset({"id", "group", "locked"})


class GroupTemplateServiceError(Exception):
    def __init__(self, message: str, *, status_code: int = 422) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class GroupTemplateView:
    id: UUID
    organization_id: UUID
    name: str
    member_count: int
    payload: dict[str, Any]
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _view(row: FairStandGroupTemplateModel) -> GroupTemplateView:
    return GroupTemplateView(
        id=row.id,
        organization_id=row.organization_id,
        name=row.name,
        member_count=row.member_count,
        payload=row.payload,
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def normalize_template_name(name: Any) -> str:
    text = " ".join(str(name or "").split())
    if not text:
        raise GroupTemplateServiceError("Şablon adı zorunludur.")
    if len(text) > TEMPLATE_NAME_MAX_LENGTH:
        raise GroupTemplateServiceError(f"Şablon adı en fazla {TEMPLATE_NAME_MAX_LENGTH} karakter olabilir.")
    return text


def _contains_image_reference(value: Any) -> bool:
    if isinstance(value, dict):
        for key, item in value.items():
            if key in _IMAGE_REFERENCE_KEYS and item not in (None, ""):
                return True
            if _contains_image_reference(item):
                return True
    elif isinstance(value, list):
        return any(_contains_image_reference(item) for item in value)
    return False


def _finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_template_payload(payload: Any) -> list[dict[str, Any]]:
    """Return the member list after shape checks; raise GroupTemplateServiceError otherwise."""
    if not isinstance(payload, dict):
        raise GroupTemplateServiceError("Şablon içeriği geçersiz.")
    if payload.get("version") != TEMPLATE_PAYLOAD_VERSION:
        raise GroupTemplateServiceError("Desteklenmeyen şablon sürümü.")
    members = payload.get("members")
    if not isinstance(members, list):
        raise GroupTemplateServiceError("Şablon parça listesi geçersiz.")
    if not TEMPLATE_MIN_MEMBERS <= len(members) <= TEMPLATE_MAX_MEMBERS:
        raise GroupTemplateServiceError(
            f"Şablonda {TEMPLATE_MIN_MEMBERS}–{TEMPLATE_MAX_MEMBERS} parça olmalıdır."
        )
    if len(json.dumps(payload, ensure_ascii=False).encode("utf-8")) > TEMPLATE_MAX_PAYLOAD_BYTES:
        raise GroupTemplateServiceError("Şablon çok büyük.")
    for index, member in enumerate(members, start=1):
        label = f"Parça {index}"
        if not isinstance(member, dict):
            raise GroupTemplateServiceError(f"{label} geçersiz.")
        item_key = member.get("itemKey")
        if not isinstance(item_key, str) or not item_key.strip() or len(item_key) > 128:
            raise GroupTemplateServiceError(f"{label} Item anahtarı geçersiz.")
        if not isinstance(member.get("type"), str) or not member["type"].strip():
            raise GroupTemplateServiceError(f"{label} tipi geçersiz.")
        forbidden = _FORBIDDEN_MEMBER_KEYS.intersection(member)
        if forbidden:
            raise GroupTemplateServiceError(f"{label} şablonda tutulmayan alan taşıyor: {', '.join(sorted(forbidden))}.")
        placement = member.get("placement")
        if not isinstance(placement, dict) or not all(
            _finite_number(placement.get(axis)) for axis in ("xCm", "yCm", "zCm", "rotationZDeg")
        ):
            raise GroupTemplateServiceError(f"{label} göreli konumu geçersiz.")
        if not _finite_number(member.get("widthCm")) or member["widthCm"] <= 0:
            raise GroupTemplateServiceError(f"{label} genişliği geçersiz.")
        if _contains_image_reference(member):
            raise GroupTemplateServiceError(f"{label} görsel taşıyor; şablonda görsel saklanmaz.")
    return members


class GroupTemplateService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _get(self, template_id: UUID, organization_id: UUID) -> FairStandGroupTemplateModel:
        row = self._session.scalar(
            select(FairStandGroupTemplateModel).where(
                FairStandGroupTemplateModel.id == template_id,
                FairStandGroupTemplateModel.organization_id == organization_id,
            )
        )
        if row is None:
            raise GroupTemplateServiceError("Şablon bulunamadı.", status_code=404)
        return row

    def _require_known_items(self, members: list[dict[str, Any]]) -> None:
        keys = {member["itemKey"] for member in members}
        known = set(
            self._session.scalars(select(FairStandItemModel.item_key).where(FairStandItemModel.item_key.in_(keys))).all()
        )
        missing = sorted(keys - known)
        if missing:
            raise GroupTemplateServiceError(f"Katalogda olmayan parça: {', '.join(missing)}.")

    def list_templates(self, organization_id: UUID) -> list[GroupTemplateView]:
        rows = self._session.scalars(
            select(FairStandGroupTemplateModel)
            .where(FairStandGroupTemplateModel.organization_id == organization_id)
            .order_by(FairStandGroupTemplateModel.updated_at.desc())
        ).all()
        return [_view(row) for row in rows]

    def get_template(self, template_id: UUID, organization_id: UUID) -> GroupTemplateView:
        return _view(self._get(template_id, organization_id))

    def create_template(
        self,
        *,
        organization_id: UUID,
        user_id: UUID | None,
        name: Any,
        payload: Any,
    ) -> GroupTemplateView:
        clean_name = normalize_template_name(name)
        members = validate_template_payload(payload)
        self._require_known_items(members)
        now = _now()
        row = FairStandGroupTemplateModel(
            id=uuid4(),
            organization_id=organization_id,
            name=clean_name,
            member_count=len(members),
            payload=payload,
            created_by=user_id,
            created_at=now,
            updated_at=now,
        )
        self._session.add(row)
        self._session.flush()
        return _view(row)

    def rename_template(self, template_id: UUID, organization_id: UUID, name: Any) -> GroupTemplateView:
        row = self._get(template_id, organization_id)
        row.name = normalize_template_name(name)
        row.updated_at = _now()
        self._session.flush()
        return _view(row)

    def delete_template(self, template_id: UUID, organization_id: UUID) -> None:
        row = self._get(template_id, organization_id)
        self._session.delete(row)
        self._session.flush()

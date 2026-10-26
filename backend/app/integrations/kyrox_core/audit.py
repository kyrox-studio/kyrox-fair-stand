"""Stand -> Core audit events (ADR-0004, D-18).

Events go to Core ``POST /api/v1/organizations/{organization_id}/audit-events`` with the
caller's bearer token; Core derives ``user_id`` and ``session_id`` from that token. Action
names use the ``fair_stand.<resource>.<verb>`` prefix.

Write semantics follow the FAIR CRM decision (platform ``projects/fair-crm/decisions/
KNOWN_DECISIONS.md`` §6, ``kyrox-core/integrations/PRODUCT_INTEGRATION_GUIDE.md`` §7):
audit writes are best-effort. A failed write is logged at warning level and never rolls
back or fails the already committed Stand mutation.

Events are queued on the SQLAlchemy session and sent only after that session commits, so
a mutation that rolls back never produces an audit row. Values pass through
``sanitize_audit_values``: only short top-level scalars are kept, secret-looking keys are
dropped, and only the names of omitted fields are recorded. The token is never logged.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import UUID

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.integrations.kyrox_core.client import KyroxCoreHttpClient

logger = get_logger(__name__)

AUDIT_ACTION_PREFIX = "fair_stand."
AUDIT_SOURCE = "fair_stand"
SCOPE_SYSTEM_CATALOG = "system_catalog"
SCOPE_ORGANIZATION = "organization"
_SCOPES = {SCOPE_SYSTEM_CATALOG, SCOPE_ORGANIZATION}

# Core: module.resource.action, lowercase segments (audit/application/service.py).
_ACTION_PATTERN = re.compile(r"^fair_stand(\.[a-z][a-z0-9_]*){2,}$")
_SENSITIVE_KEY_PATTERN = re.compile(
    r"(token|secret|password|passwd|credential|authorization|api[_-]?key|host[_-]?key|cookie|session)",
    re.IGNORECASE,
)
MAX_AUDIT_STRING_LENGTH = 200
MAX_AUDIT_FIELDS = 50
MAX_AUDIT_KEY_LENGTH = 64

_PENDING_KEY = "fair_stand_pending_audit_events"
_LISTENING_KEY = "fair_stand_audit_listening"


class AuditPort(Protocol):
    def record_event(
        self,
        *,
        organization_id: UUID,
        access_token: str,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        old_values: dict | None = None,
        new_values: dict | None = None,
        metadata: dict | None = None,
    ) -> None: ...


@dataclass(frozen=True)
class SanitizedValues:
    values: dict[str, Any] | None
    omitted_fields: list[str] = field(default_factory=list)


def _safe_key(key: object) -> str:
    return str(key)[:MAX_AUDIT_KEY_LENGTH]


def sanitize_audit_values(values: Mapping[str, Any] | None) -> SanitizedValues:
    """Keep short top-level scalars; drop secrets, nested data and long text."""
    if not values:
        return SanitizedValues(values=None)
    kept: dict[str, Any] = {}
    omitted: list[str] = []
    for raw_key, value in values.items():
        key = _safe_key(raw_key)
        if _SENSITIVE_KEY_PATTERN.search(key):
            omitted.append(key)
            continue
        if value is None or isinstance(value, bool | int | float):
            kept[key] = value
        elif isinstance(value, str) and len(value) <= MAX_AUDIT_STRING_LENGTH:
            kept[key] = value
        else:
            omitted.append(key)
    kept_items = dict(list(kept.items())[:MAX_AUDIT_FIELDS])
    omitted.extend(list(kept)[MAX_AUDIT_FIELDS:])
    return SanitizedValues(
        values=kept_items or None,
        omitted_fields=sorted(set(omitted))[:MAX_AUDIT_FIELDS],
    )


class HttpAuditAdapter:
    """Best-effort Core audit writer; failures are logged and never propagated."""

    def __init__(self, http_client: KyroxCoreHttpClient | None = None) -> None:
        self._http = http_client or KyroxCoreHttpClient()

    def record_event(
        self,
        *,
        organization_id: UUID,
        access_token: str,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        old_values: dict | None = None,
        new_values: dict | None = None,
        metadata: dict | None = None,
    ) -> None:
        body = {
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "old_values": old_values,
            "new_values": new_values,
            "metadata": metadata,
        }
        try:
            response = self._http.request(
                "POST",
                f"/api/v1/organizations/{organization_id}/audit-events",
                access_token=access_token,
                organization_id=organization_id,
                json=body,
            )
        except Exception as exc:  # best-effort: the Stand mutation is already committed
            logger.warning(
                "Best-effort Core audit write failed; Stand operation succeeded. "
                "action=%s resource_type=%s resource_id=%s error=%s",
                action,
                resource_type,
                resource_id,
                type(exc).__name__,
            )
            return
        if response.status_code >= 400:
            logger.warning(
                "Best-effort Core audit write failed; Stand operation succeeded. "
                "status=%s action=%s resource_type=%s resource_id=%s",
                response.status_code,
                action,
                resource_type,
                resource_id,
            )


class NoOpAuditAdapter:
    """Dev bypass: Core is not reachable, so audit writes are skipped."""

    def record_event(self, **kwargs) -> None:
        logger.debug("Dev bypass: audit write skipped (%s)", kwargs.get("action"))


@dataclass(frozen=True)
class _PendingAuditEvent:
    adapter: AuditPort
    organization_id: UUID
    access_token: str
    action: str
    resource_type: str
    resource_id: str | None
    old_values: dict | None
    new_values: dict | None
    metadata: dict


def _flush_pending(session: Session) -> None:
    pending: list[_PendingAuditEvent] = session.info.pop(_PENDING_KEY, [])
    for item in pending:
        try:
            item.adapter.record_event(
                organization_id=item.organization_id,
                access_token=item.access_token,
                action=item.action,
                resource_type=item.resource_type,
                resource_id=item.resource_id,
                old_values=item.old_values,
                new_values=item.new_values,
                metadata=item.metadata,
            )
        except Exception as exc:  # never break the committed request
            logger.warning(
                "Best-effort Core audit write failed; Stand operation succeeded. action=%s error=%s",
                item.action,
                type(exc).__name__,
            )


def _discard_pending(session: Session, *_args) -> None:
    session.info.pop(_PENDING_KEY, None)


def _ensure_listeners(session: Session) -> None:
    if session.info.get(_LISTENING_KEY):
        return
    event.listen(session, "after_commit", _flush_pending)
    event.listen(session, "after_soft_rollback", _discard_pending)
    session.info[_LISTENING_KEY] = True


class StandAuditRecorder:
    """Request-bound recorder; events are sent after the request session commits."""

    def __init__(
        self,
        *,
        session: Session,
        adapter: AuditPort,
        organization_id: UUID,
        access_token: str,
    ) -> None:
        self._session = session
        self._adapter = adapter
        self._organization_id = organization_id
        self._access_token = access_token

    def record(
        self,
        action: str,
        resource_type: str,
        resource_id: object | None = None,
        *,
        scope: str,
        new_values: Mapping[str, Any] | None = None,
        old_values: Mapping[str, Any] | None = None,
    ) -> None:
        if not _ACTION_PATTERN.match(action):
            raise ValueError(f"Audit action must follow fair_stand.<resource>.<verb>: {action}")
        if scope not in _SCOPES:
            raise ValueError(f"Unknown audit scope: {scope}")
        new_clean = sanitize_audit_values(new_values)
        old_clean = sanitize_audit_values(old_values)
        metadata: dict[str, Any] = {"source": AUDIT_SOURCE, "scope": scope}
        if new_values:
            metadata["changed_fields"] = sorted(_safe_key(key) for key in new_values)[:MAX_AUDIT_FIELDS]
        omitted = sorted(set(new_clean.omitted_fields) | set(old_clean.omitted_fields))
        if omitted:
            metadata["omitted_fields"] = omitted[:MAX_AUDIT_FIELDS]
        _ensure_listeners(self._session)
        self._session.info.setdefault(_PENDING_KEY, []).append(
            _PendingAuditEvent(
                adapter=self._adapter,
                organization_id=self._organization_id,
                access_token=self._access_token,
                action=action,
                resource_type=resource_type,
                resource_id=None if resource_id is None else str(resource_id),
                old_values=old_clean.values,
                new_values=new_clean.values,
                metadata=metadata,
            )
        )

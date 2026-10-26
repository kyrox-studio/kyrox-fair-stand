"""Core organization lifecycle consumer (ADR-0006, D-12).

Core is the lifecycle authority. Stand reads the product lifecycle snapshot and refuses
organization-owned writes unless Core reports ``work_allowed=true``. Every doubt (missing
credential, network error, unexpected status, malformed or inconsistent body) fails closed.
The contract and validation rules mirror FAIR CRM ``integrations/kyrox_core/lifecycle.py``.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

import httpx

from app.core.config import get_settings
from app.core.exceptions import FairStandError
from app.core.logging import get_logger

logger = get_logger(__name__)

_VALID_STATUSES = {"pending_activation", "active", "suspended", "archived"}
PRODUCT_LIFECYCLE_TOKEN_MIN_LENGTH = 32
_INSECURE_TOKEN_PREFIX = "dev-insecure"
LIFECYCLE_TOKEN_HEADER = "X-Kyrox-Product-Lifecycle-Token"

# Yalnız "iş yapılabilir" cevabı kısa süre hatırlanır (yetki önbelleğiyle aynı süre); askıya
# alma en geç bu süre sonunda yazmaları durdurur. Ret ve hatalar her seferinde Core'a sorulur.
WORK_ALLOWED_CACHE_TTL_SECONDS = 10.0
WORK_ALLOWED_CACHE_MAX_ENTRIES = 1024


def configured_product_lifecycle_token(token: str | None) -> str | None:
    """Return the lifecycle credential only when it is safe to send to Core."""
    if (
        not token
        or len(token) < PRODUCT_LIFECYCLE_TOKEN_MIN_LENGTH
        or token.startswith(_INSECURE_TOKEN_PREFIX)
    ):
        return None
    return token


class OrganizationLifecycleUnavailableError(FairStandError):
    """Canonical Core lifecycle eligibility could not be established."""


class OrganizationWorkNotAllowedError(FairStandError):
    """Canonical Core lifecycle state explicitly prohibits product work."""


@dataclass(frozen=True, slots=True)
class OrganizationLifecycleSnapshot:
    organization_id: UUID
    status: str
    work_allowed: bool
    updated_at: datetime
    is_deleted: bool = False
    deleted_at: datetime | None = None


class KyroxCoreLifecycleClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        lifecycle_token: str | None = None,
    ) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.kyrox_core_base_url).rstrip("/")
        self._lifecycle_token = configured_product_lifecycle_token(
            lifecycle_token or settings.kyrox_core_product_lifecycle_token
        )

    def get_snapshot(self, organization_id: UUID) -> httpx.Response:
        if self._lifecycle_token is None:
            logger.error(
                "Core lifecycle credential is not configured: organization_id=%s",
                organization_id,
            )
            raise OrganizationLifecycleUnavailableError(
                "Organization lifecycle credential is not configured"
            )
        url = f"{self._base_url}/api/v1/organizations/{organization_id}/lifecycle-snapshot"
        headers = {
            LIFECYCLE_TOKEN_HEADER: self._lifecycle_token,
            "Accept": "application/json",
        }
        with httpx.Client(timeout=10.0) as client:
            return client.get(url, headers=headers)


class WorkAllowedCache:
    def __init__(self, ttl_seconds: float, max_entries: int, clock=time.monotonic) -> None:
        self._ttl = ttl_seconds
        self._max = max_entries
        self._clock = clock
        self._entries: dict[UUID, float] = {}
        self._lock = threading.Lock()

    def is_allowed(self, organization_id: UUID) -> bool:
        now = self._clock()
        with self._lock:
            expires_at = self._entries.get(organization_id)
            if expires_at is None:
                return False
            if expires_at <= now:
                del self._entries[organization_id]
                return False
            return True

    def remember_allowed(self, organization_id: UUID) -> None:
        with self._lock:
            self._entries.pop(organization_id, None)
            self._entries[organization_id] = self._clock() + self._ttl
            while len(self._entries) > self._max:
                self._entries.pop(next(iter(self._entries)))

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


work_allowed_cache = WorkAllowedCache(WORK_ALLOWED_CACHE_TTL_SECONDS, WORK_ALLOWED_CACHE_MAX_ENTRIES)


def _parse_timestamp(raw: object, message: str) -> datetime:
    if not isinstance(raw, str):
        raise OrganizationLifecycleUnavailableError(message)
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise OrganizationLifecycleUnavailableError(message) from exc


class OrganizationLifecycleGuard:
    """Fail-closed read adapter for Core-owned organization lifecycle eligibility."""

    def __init__(
        self,
        client: KyroxCoreLifecycleClient | None = None,
        cache: WorkAllowedCache | None = None,
    ) -> None:
        self._client = client or KyroxCoreLifecycleClient()
        self._cache = cache if cache is not None else work_allowed_cache

    def get_snapshot(self, organization_id: UUID) -> OrganizationLifecycleSnapshot:
        try:
            response = self._client.get_snapshot(organization_id)
        except httpx.RequestError as exc:
            logger.warning(
                "Core lifecycle snapshot unreachable: organization_id=%s error=%s",
                organization_id,
                type(exc).__name__,
            )
            raise OrganizationLifecycleUnavailableError(
                "Organization lifecycle authority unavailable"
            ) from exc

        if response.status_code != 200:
            logger.warning(
                "Core lifecycle snapshot failed: organization_id=%s status=%s",
                organization_id,
                response.status_code,
            )
            raise OrganizationLifecycleUnavailableError(
                "Organization lifecycle authority check failed"
            )

        try:
            data = response.json()
            returned_organization_id = UUID(str(data["organization_id"]))
            lifecycle_status = data["status"]
            work_allowed = data["work_allowed"]
            updated_at_raw = data["updated_at"]
            is_deleted = data.get("is_deleted", False)
            deleted_at_raw = data.get("deleted_at")
        except (KeyError, TypeError, ValueError, AttributeError) as exc:
            raise OrganizationLifecycleUnavailableError(
                "Organization lifecycle authority returned an invalid response"
            ) from exc

        if returned_organization_id != organization_id:
            raise OrganizationLifecycleUnavailableError(
                "Organization lifecycle authority returned the wrong organization"
            )
        if (
            not isinstance(lifecycle_status, str)
            or lifecycle_status not in _VALID_STATUSES
            or type(work_allowed) is not bool
            or type(is_deleted) is not bool
        ):
            raise OrganizationLifecycleUnavailableError(
                "Organization lifecycle authority returned an invalid response"
            )

        updated_at = _parse_timestamp(
            updated_at_raw,
            "Organization lifecycle authority returned an invalid update timestamp",
        )
        deleted_at = None
        if deleted_at_raw is not None:
            deleted_at = _parse_timestamp(
                deleted_at_raw,
                "Organization lifecycle authority returned an invalid deletion timestamp",
            )

        if is_deleted != (deleted_at is not None):
            raise OrganizationLifecycleUnavailableError(
                "Organization lifecycle authority returned inconsistent deletion state"
            )
        if work_allowed != (lifecycle_status == "active" and not is_deleted):
            raise OrganizationLifecycleUnavailableError(
                "Organization lifecycle authority returned an inconsistent response"
            )

        return OrganizationLifecycleSnapshot(
            organization_id=returned_organization_id,
            status=lifecycle_status,
            work_allowed=work_allowed,
            updated_at=updated_at,
            is_deleted=is_deleted,
            deleted_at=deleted_at,
        )

    def require_work_allowed(self, organization_id: UUID) -> None:
        if self._cache.is_allowed(organization_id):
            return
        snapshot = self.get_snapshot(organization_id)
        if not snapshot.work_allowed:
            state = "deleted" if snapshot.is_deleted else snapshot.status
            raise OrganizationWorkNotAllowedError(
                f"Organization lifecycle does not allow product work: {state}"
            )
        self._cache.remember_allowed(organization_id)

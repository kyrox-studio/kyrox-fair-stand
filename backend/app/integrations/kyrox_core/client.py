import hashlib
import threading
import time
from collections import OrderedDict
from uuid import UUID

import httpx

from app.core.config import get_settings
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.logging import get_logger
from app.integrations.kyrox_core.ports import AuthorizationPort

logger = get_logger(__name__)


class KyroxCoreHttpClient:
    def __init__(self, base_url: str | None = None) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.kyrox_core_base_url).rstrip("/")

    def request(
        self,
        method: str,
        path: str,
        *,
        access_token: str,
        organization_id: UUID,
        json: dict | None = None,
    ) -> httpx.Response:
        url = f"{self._base_url}{path}"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "X-Organization-Id": str(organization_id),
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=10.0) as client:
            return client.request(method, url, headers=headers, json=json)


# Core'un "izin var" cevabı aynı oturum + organizasyon + yetki için kısa süre hatırlanır.
# Proje açılışında her görsel isteği ayrı yetki sorgusu atıyordu (13 görsel = 13 core isteği).
# Yalnız olumlu cevap saklanır; "izin yok" ve hatalar her seferinde core'a sorulur. Yetki
# kaldırılırsa en geç PERMISSION_CACHE_TTL_SECONDS sonra geçerli olur. Anahtar jetonun
# kendisi değil SHA-256 özetidir.
PERMISSION_CACHE_TTL_SECONDS = 10.0
PERMISSION_CACHE_MAX_ENTRIES = 1024


class PermissionDecisionCache:
    def __init__(self, ttl_seconds: float, max_entries: int, clock=time.monotonic) -> None:
        self._ttl = ttl_seconds
        self._max = max_entries
        self._clock = clock
        self._entries: OrderedDict[tuple[str, str, str], float] = OrderedDict()
        self._lock = threading.Lock()

    @staticmethod
    def key(access_token: str, organization_id: UUID, permission_code: str) -> tuple[str, str, str]:
        token_digest = hashlib.sha256(access_token.encode("utf-8")).hexdigest()
        return (token_digest, str(organization_id), permission_code)

    def is_allowed(self, key: tuple[str, str, str]) -> bool:
        now = self._clock()
        with self._lock:
            expires_at = self._entries.get(key)
            if expires_at is None:
                return False
            if expires_at <= now:
                del self._entries[key]
                return False
            return True

    def remember_allowed(self, key: tuple[str, str, str]) -> None:
        with self._lock:
            self._entries[key] = self._clock() + self._ttl
            self._entries.move_to_end(key)
            while len(self._entries) > self._max:
                self._entries.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


permission_decision_cache = PermissionDecisionCache(
    PERMISSION_CACHE_TTL_SECONDS,
    PERMISSION_CACHE_MAX_ENTRIES,
)


class HttpAuthorizationAdapter(AuthorizationPort):
    def __init__(
        self,
        http_client: KyroxCoreHttpClient | None = None,
        decision_cache: PermissionDecisionCache | None = None,
    ) -> None:
        self._http = http_client or KyroxCoreHttpClient()
        self._decisions = decision_cache or permission_decision_cache

    def check_permission(
        self,
        *,
        organization_id: UUID,
        user_id: UUID,
        permission_code: str,
        access_token: str,
    ) -> bool:
        _ = user_id
        cache_key = PermissionDecisionCache.key(access_token, organization_id, permission_code)
        if self._decisions.is_allowed(cache_key):
            return True
        path = f"/api/v1/organizations/{organization_id}/authorization/check"
        try:
            response = self._http.request(
                "POST",
                path,
                access_token=access_token,
                organization_id=organization_id,
                json={"permission_code": permission_code},
            )
        except httpx.RequestError as exc:
            raise ForbiddenError("Authorization service unavailable") from exc
        if response.status_code == 403:
            return False
        # Oturum Core'da yok/iptal (ör. başka bir Core DB'si): istemci yeniden giriş yapmalı.
        if response.status_code == 401:
            raise UnauthorizedError("Session is not valid in Kyrox Core")
        if response.status_code >= 400:
            raise ForbiddenError("Authorization check failed")
        allowed = bool(response.json().get("allowed"))
        if allowed:
            self._decisions.remember_allowed(cache_key)
        return allowed

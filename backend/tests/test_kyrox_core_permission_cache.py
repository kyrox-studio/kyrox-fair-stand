"""Core yetki sorgusu: olumlu cevap kısa süre hatırlanır, olumsuz cevap hiç hatırlanmaz."""

from __future__ import annotations

from uuid import uuid4

import httpx
import pytest

from app.core.exceptions import ForbiddenError
from app.integrations.kyrox_core.client import (
    PERMISSION_CACHE_TTL_SECONDS,
    HttpAuthorizationAdapter,
    PermissionDecisionCache,
)


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class FakeCoreHttp:
    def __init__(self, responses: list[httpx.Response]) -> None:
        self._responses = responses
        self.calls: list[dict] = []

    def request(self, method, path, *, access_token, organization_id, json=None):
        self.calls.append({"token": access_token, "org": organization_id, "permission": json["permission_code"]})
        return self._responses.pop(0)


def _allowed(value: bool) -> httpx.Response:
    return httpx.Response(200, json={"allowed": value})


def _adapter(responses, clock=None, max_entries=1024):
    http = FakeCoreHttp(responses)
    cache = PermissionDecisionCache(PERMISSION_CACHE_TTL_SECONDS, max_entries, clock=clock or FakeClock())
    return HttpAuthorizationAdapter(http_client=http, decision_cache=cache), http


def _check(adapter, *, token="tok-a", org=None, permission="fair_stand.projects.read"):
    return adapter.check_permission(
        organization_id=org or ORG,
        user_id=uuid4(),
        permission_code=permission,
        access_token=token,
    )


ORG = uuid4()


def test_ttl_is_ten_seconds() -> None:
    assert PERMISSION_CACHE_TTL_SECONDS == 10.0


def test_allowed_answer_is_reused_within_ttl_so_core_is_asked_once() -> None:
    adapter, http = _adapter([_allowed(True)])
    assert all(_check(adapter) for _ in range(13))
    assert len(http.calls) == 1


def test_allowed_answer_expires_after_ttl() -> None:
    clock = FakeClock()
    adapter, http = _adapter([_allowed(True), _allowed(False)], clock=clock)
    assert _check(adapter) is True
    clock.now += PERMISSION_CACHE_TTL_SECONDS
    assert _check(adapter) is False
    assert len(http.calls) == 2


def test_denied_answer_is_never_cached() -> None:
    adapter, http = _adapter([_allowed(False), httpx.Response(403), _allowed(True)])
    assert _check(adapter) is False
    assert _check(adapter) is False
    assert _check(adapter) is True
    assert len(http.calls) == 3


def test_errors_are_not_cached_and_still_raise() -> None:
    adapter, http = _adapter([httpx.Response(500), _allowed(True)])
    with pytest.raises(ForbiddenError):
        _check(adapter)
    assert _check(adapter) is True
    assert len(http.calls) == 2


def test_token_organization_and_permission_each_have_their_own_answer() -> None:
    adapter, http = _adapter([_allowed(True)] * 4)
    other_org = uuid4()
    assert _check(adapter, token="tok-a") is True
    assert _check(adapter, token="tok-b") is True
    assert _check(adapter, token="tok-a", org=other_org) is True
    assert _check(adapter, token="tok-a", permission="fair_stand.projects.update") is True
    assert len(http.calls) == 4
    # Hepsi ayrı ayrı hatırlandı.
    assert _check(adapter, token="tok-b") is True
    assert len(http.calls) == 4


def test_cache_key_stores_a_digest_not_the_token() -> None:
    key = PermissionDecisionCache.key("gizli-jeton", ORG, "p")
    assert "gizli-jeton" not in "".join(key)
    assert len(key[0]) == 64


def test_cache_size_is_bounded() -> None:
    adapter, http = _adapter([_allowed(True)] * 4, max_entries=2)
    for token in ("t1", "t2", "t3"):
        _check(adapter, token=token)
    # En eski (t1) atıldı; tekrar sorulur.
    _check(adapter, token="t1")
    assert len(http.calls) == 4

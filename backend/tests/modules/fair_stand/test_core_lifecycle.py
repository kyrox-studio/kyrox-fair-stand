"""D-12 / K-STAND-02: Stand consumes the Core lifecycle snapshot and fails closed."""

from __future__ import annotations

import logging
from types import SimpleNamespace
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi.routing import APIRoute

from app.integrations.kyrox_core import lifecycle as lifecycle_module
from app.integrations.kyrox_core.lifecycle import (
    LIFECYCLE_TOKEN_HEADER,
    KyroxCoreLifecycleClient,
    OrganizationLifecycleGuard,
    OrganizationLifecycleUnavailableError,
    OrganizationWorkNotAllowedError,
    WorkAllowedCache,
    configured_product_lifecycle_token,
)
from app.integrations.kyrox_core.ports import AuthorizationPort
from app.main import app
from app.modules.fair_stand.api import (
    cost_item_routes,
    group_template_routes,
    live_share_routes,
    project_routes,
    routes,
)
from app.modules.fair_stand.api.dependencies import get_authorization_adapter, get_lifecycle_guard

CUSTOMER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
SAFE_TOKEN = "lifecycle-test-credential-0123456789abcdef"


def _snapshot(target_organization_id: UUID, **overrides) -> dict:
    body = {
        "organization_id": str(target_organization_id),
        "status": "active",
        "work_allowed": True,
        "is_deleted": False,
        "deleted_at": None,
        "updated_at": "2026-10-27T10:00:00Z",
    }
    body.update(overrides)
    return body


class FakeLifecycleClient:
    def __init__(self, *, status_code: int = 200, body: dict | None = None, error: Exception | None = None):
        self.status_code = status_code
        self.body = body
        self.error = error
        self.calls = 0

    def get_snapshot(self, organization_id: UUID):
        self.calls += 1
        if self.error is not None:
            raise self.error
        return SimpleNamespace(status_code=self.status_code, json=lambda: self.body, text="")


def _guard(client: FakeLifecycleClient) -> OrganizationLifecycleGuard:
    return OrganizationLifecycleGuard(client=client, cache=WorkAllowedCache(10.0, 16))


# --- snapshot consumer ---------------------------------------------------------------


def test_active_organization_allows_work_and_caches_only_allow():
    organization_id = uuid4()
    client = FakeLifecycleClient(body=_snapshot(organization_id))
    guard = _guard(client)
    guard.require_work_allowed(organization_id)
    guard.require_work_allowed(organization_id)
    assert client.calls == 1


@pytest.mark.parametrize(
    "overrides",
    [
        {"status": "suspended", "work_allowed": False},
        {"status": "pending_activation", "work_allowed": False},
        {"status": "archived", "work_allowed": False},
        {"status": "active", "work_allowed": False, "is_deleted": True, "deleted_at": "2026-10-27T09:00:00Z"},
        {"status": "suspended", "work_allowed": False, "is_deleted": True, "deleted_at": "2026-10-27T09:00:00Z"},
    ],
)
def test_suspended_or_deleted_organization_refuses_work_every_time(overrides):
    organization_id = uuid4()
    client = FakeLifecycleClient(body=_snapshot(organization_id, **overrides))
    guard = _guard(client)
    for _ in range(2):
        with pytest.raises(OrganizationWorkNotAllowedError):
            guard.require_work_allowed(organization_id)
    assert client.calls == 2


@pytest.mark.parametrize(
    "client_kwargs",
    [
        {"error": httpx.ConnectError("down")},
        {"status_code": 500, "body": {}},
        {"status_code": 401, "body": {"detail": "Invalid product lifecycle credential"}},
        {"status_code": 404, "body": {"detail": "Organization not found"}},
        {"status_code": 503, "body": {"detail": "Product lifecycle credential is not configured"}},
    ],
)
def test_core_errors_fail_closed(client_kwargs):
    organization_id = uuid4()
    with pytest.raises(OrganizationLifecycleUnavailableError):
        _guard(FakeLifecycleClient(**client_kwargs)).require_work_allowed(organization_id)


@pytest.mark.parametrize(
    "overrides",
    [
        {"organization_id": "11111111-1111-4111-8111-111111111111"},
        {"status": "frozen"},
        {"work_allowed": "true"},
        {"status": "suspended", "work_allowed": True},
        {"is_deleted": True, "deleted_at": None},
        {"is_deleted": False, "deleted_at": "2026-10-27T09:00:00Z"},
        {"updated_at": "not-a-date"},
        {"updated_at": None},
    ],
)
def test_invalid_or_inconsistent_snapshot_fails_closed(overrides):
    organization_id = uuid4()
    client = FakeLifecycleClient(body=_snapshot(organization_id, **overrides))
    with pytest.raises(OrganizationLifecycleUnavailableError):
        _guard(client).require_work_allowed(organization_id)


def test_missing_body_fields_fail_closed():
    organization_id = uuid4()
    body = _snapshot(organization_id)
    del body["work_allowed"]
    with pytest.raises(OrganizationLifecycleUnavailableError):
        _guard(FakeLifecycleClient(body=body)).require_work_allowed(organization_id)


@pytest.mark.parametrize("token", [None, "", "short", "dev-insecure-" + "x" * 40])
def test_unsafe_lifecycle_credential_is_never_sent(token, monkeypatch):
    assert configured_product_lifecycle_token(token) is None

    def _no_http(*args, **kwargs):
        raise AssertionError("Core must not be contacted without a safe credential")

    monkeypatch.setattr(lifecycle_module.httpx, "Client", _no_http)
    monkeypatch.setattr(
        lifecycle_module,
        "get_settings",
        lambda: SimpleNamespace(kyrox_core_base_url="http://core.test", kyrox_core_product_lifecycle_token=token),
    )
    with pytest.raises(OrganizationLifecycleUnavailableError):
        KyroxCoreLifecycleClient().get_snapshot(uuid4())


def test_client_sends_credential_header_and_never_logs_it(monkeypatch, caplog):
    organization_id = uuid4()
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["header"] = request.headers.get(LIFECYCLE_TOKEN_HEADER)
        seen["authorization"] = request.headers.get("Authorization")
        return httpx.Response(500, json={"detail": "boom"})

    real_client = httpx.Client
    monkeypatch.setattr(
        lifecycle_module.httpx,
        "Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    client = KyroxCoreLifecycleClient(base_url="http://core.test/", lifecycle_token=SAFE_TOKEN)
    guard = OrganizationLifecycleGuard(client=client, cache=WorkAllowedCache(10.0, 16))
    with caplog.at_level(logging.DEBUG), pytest.raises(OrganizationLifecycleUnavailableError):
        guard.require_work_allowed(organization_id)
    assert seen["url"] == f"http://core.test/api/v1/organizations/{organization_id}/lifecycle-snapshot"
    assert seen["header"] == SAFE_TOKEN
    assert seen["authorization"] is None
    assert SAFE_TOKEN not in caplog.text


def test_settings_read_lifecycle_credential_from_environment(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("KYROX_CORE_PRODUCT_LIFECYCLE_TOKEN", SAFE_TOKEN)
    assert Settings(_env_file=None).kyrox_core_product_lifecycle_token == SAFE_TOKEN
    monkeypatch.delenv("KYROX_CORE_PRODUCT_LIFECYCLE_TOKEN")
    assert Settings(_env_file=None).kyrox_core_product_lifecycle_token is None


# --- HTTP gate -----------------------------------------------------------------------


class RefusingGuard:
    def __init__(self, error: Exception) -> None:
        self.error = error
        self.calls = 0

    def require_work_allowed(self, organization_id: UUID) -> None:
        self.calls += 1
        raise self.error


class DenyAllAuthorization(AuthorizationPort):
    def check_permission(self, **kwargs) -> bool:
        _ = kwargs
        return False


def _png() -> bytes:
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), color=(1, 2, 3)).save(buffer, format="PNG")
    return buffer.getvalue()


def _write_requests(project_id: str, asset_id: str, template_id: str, price_id: str):
    project_body = {"name": "Askı", "customerId": CUSTOMER_ID, "payload": {"stand": {}, "modules": []}}
    return [
        ("POST", "/api/v1/fair-stand/projects", {"json": project_body}),
        ("PUT", f"/api/v1/fair-stand/projects/{project_id}", {"json": {"name": "x"}}),
        ("PUT", f"/api/v1/fair-stand/projects/{uuid4()}", {"json": project_body}),
        ("PATCH", f"/api/v1/fair-stand/projects/{project_id}/customer", {"json": {"customerId": CUSTOMER_ID}}),
        ("DELETE", f"/api/v1/fair-stand/projects/{project_id}", {}),
        ("POST", f"/api/v1/fair-stand/projects/{project_id}/assets", {"files": {"file": ("a.png", _png(), "image/png")}}),
        ("DELETE", f"/api/v1/fair-stand/projects/{project_id}/assets/{asset_id}", {}),
        ("POST", "/api/v1/fair-stand/cost-items", {"json": {"costItemType": "MANUAL", "name": "Nakliye", "unit": "adet", "purchasePrice": "1"}}),
        ("PATCH", f"/api/v1/fair-stand/cost-items/{price_id}", {"json": {"purchasePrice": "2"}}),
        ("DELETE", f"/api/v1/fair-stand/cost-items/{price_id}", {}),
        ("POST", "/api/v1/fair-stand/group-templates", {"json": {"name": "Şablon", "payload": {}}}),
        ("PATCH", f"/api/v1/fair-stand/group-templates/{template_id}", {"json": {"name": "y"}}),
        ("DELETE", f"/api/v1/fair-stand/group-templates/{template_id}", {}),
        ("POST", "/api/v1/fair-stand/live-shares", {}),
    ]


def _seed_project(client, auth_headers, tmp_path, monkeypatch) -> tuple[str, str]:
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()
    created = client.post(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        json={"name": "Askı", "customerId": CUSTOMER_ID, "payload": {"stand": {}, "modules": []}},
    )
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    asset = client.post(
        f"/api/v1/fair-stand/projects/{project_id}/assets",
        headers=auth_headers,
        files={"file": ("a.png", _png(), "image/png")},
    )
    assert asset.status_code == 201, asset.text
    return project_id, asset.json()["id"]


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (OrganizationWorkNotAllowedError("suspended"), 403),
        (OrganizationLifecycleUnavailableError("down"), 503),
    ],
)
def test_organization_owned_writes_fail_closed(client, auth_headers, tmp_path, monkeypatch, error, expected_status):
    project_id, asset_id = _seed_project(client, auth_headers, tmp_path, monkeypatch)
    guard = RefusingGuard(error)
    app.dependency_overrides[get_lifecycle_guard] = lambda: guard

    for method, path, kwargs in _write_requests(project_id, asset_id, str(uuid4()), str(uuid4())):
        response = client.request(method, path, headers=auth_headers, **kwargs)
        assert response.status_code == expected_status, (method, path, response.text)

    # Nothing changed: the project and its asset are still there and readable.
    detail = client.get(f"/api/v1/fair-stand/projects/{project_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["name"] == "Askı"
    assert [asset["id"] for asset in detail.json()["assets"]] == [asset_id]
    assert client.get("/api/v1/fair-stand/cost-items", headers=auth_headers).json()["prices"] == []
    assert client.get("/api/v1/fair-stand/group-templates", headers=auth_headers).json()["templates"] == []


def test_reads_are_not_lifecycle_gated(client, auth_headers):
    guard = RefusingGuard(OrganizationWorkNotAllowedError("suspended"))
    app.dependency_overrides[get_lifecycle_guard] = lambda: guard
    assert client.get("/api/v1/fair-stand/projects", headers=auth_headers).status_code == 200
    assert client.get("/api/v1/fair-stand/cost-items", headers=auth_headers).status_code == 200
    assert guard.calls == 0


def test_permission_is_checked_before_lifecycle(client, auth_headers):
    guard = RefusingGuard(OrganizationLifecycleUnavailableError("down"))
    app.dependency_overrides[get_lifecycle_guard] = lambda: guard
    app.dependency_overrides[get_authorization_adapter] = lambda: DenyAllAuthorization()
    response = client.post(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        json={"name": "x", "customerId": CUSTOMER_ID},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Permission denied"
    assert guard.calls == 0


def _dependency_calls(dependant) -> set:
    calls = set()
    for dependency in dependant.dependencies:
        calls.add(dependency.call)
        calls |= _dependency_calls(dependency)
    return calls


# Canlı paylaşımı durdurma tenant verisine yazmaz ve işi azaltır; host anahtarıyla korunur.
LIFECYCLE_EXEMPT_WRITES = {("POST", "/fair-stand/live-shares/{token}/stop")}
ORGANIZATION_WRITE_PREFIXES = (
    "/fair-stand/projects",
    "/fair-stand/cost-items",
    "/fair-stand/group-templates",
    "/fair-stand/live-shares",
)
# app.main bu router'ları /api/v1 önekiyle bağlar.
STAND_ROUTERS = (
    routes.router,
    project_routes.router,
    cost_item_routes.router,
    group_template_routes.router,
    live_share_routes.router,
)


def test_every_organization_owned_write_route_is_lifecycle_gated():
    checked = []
    for route in (route for router in STAND_ROUTERS for route in router.routes):
        if not isinstance(route, APIRoute) or not route.path.startswith(ORGANIZATION_WRITE_PREFIXES):
            continue
        for method in sorted(route.methods & {"POST", "PUT", "PATCH", "DELETE"}):
            if (method, route.path) in LIFECYCLE_EXEMPT_WRITES:
                continue
            assert get_lifecycle_guard in _dependency_calls(route.dependant), (method, route.path)
            checked.append((method, route.path))
    assert len(checked) == 13

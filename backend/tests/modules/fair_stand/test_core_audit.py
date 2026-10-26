"""D-18 / F-S8: Stand admin mutations and project deletion are sent to Core audit."""

from __future__ import annotations

import logging
import re
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import httpx
from fastapi.routing import APIRoute
from sqlalchemy import text

from app.integrations.kyrox_core.audit import (
    HttpAuditAdapter,
    NoOpAuditAdapter,
    StandAuditRecorder,
    sanitize_audit_values,
)
from app.main import app
from app.modules.fair_stand.api import (
    cost_item_routes,
    group_template_routes,
    live_share_routes,
    project_routes,
    routes,
)
from app.modules.fair_stand.api import dependencies as dependencies_module
from app.modules.fair_stand.api.dependencies import get_audit_adapter, get_stand_audit
from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

CUSTOMER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
# Core audit/application/service.py: module.resource.action
CORE_ACTION_PATTERN = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$")
API_DIR = Path(__file__).resolve().parents[3] / "app" / "modules" / "fair_stand" / "api"


def _dependency_calls(dependant) -> set:
    calls = set()
    for dependency in dependant.dependencies:
        calls.add(dependency.call)
        calls |= _dependency_calls(dependency)
    return calls


# app.main bu router'ları /api/v1 önekiyle bağlar; yollar router önekini içerir.
STAND_ROUTERS = (
    routes.router,
    project_routes.router,
    cost_item_routes.router,
    group_template_routes.router,
    live_share_routes.router,
)


def _mutation_routes(prefix: str) -> list[tuple[str, APIRoute]]:
    found = []
    for route in (route for router in STAND_ROUTERS for route in router.routes):
        if isinstance(route, APIRoute) and route.path.startswith(prefix):
            for method in sorted(route.methods & {"POST", "PUT", "PATCH", "DELETE"}):
                found.append((method, route))
    return found


def _bearer(headers: dict[str, str]) -> str:
    return headers["Authorization"].removeprefix("Bearer ")


def test_every_admin_mutation_route_records_core_audit():
    admin_mutations = _mutation_routes("/fair-stand/admin")
    assert len(admin_mutations) == 33
    for method, route in admin_mutations:
        assert get_stand_audit in _dependency_calls(route.dependant), (method, route.path)

    project_delete = [
        route for method, route in _mutation_routes("/fair-stand/projects/")
        if method == "DELETE" and route.path == "/fair-stand/projects/{project_id}"
    ]
    assert len(project_delete) == 1
    assert get_stand_audit in _dependency_calls(project_delete[0].dependant)


def test_audit_actions_use_fair_stand_prefix_and_core_naming():
    source = "\n".join(path.read_text(encoding="utf-8") for path in API_DIR.glob("*.py"))
    actions = set(re.findall(r'"(fair_stand\.[a-z0-9_.]+)"', source))
    assert len(actions) == 34
    for action in actions:
        assert CORE_ACTION_PATTERN.match(action), action
        assert len(action.split(".")) == 3, action


def test_admin_create_sends_event_after_commit(client, db_session, auth_headers, organization_id, audit_adapter):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    created = client.post(
        "/api/v1/fair-stand/admin/categories",
        json={"catalog_name": "QA", "catalog_index": 90},
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    assert len(audit_adapter.events) == 1
    event = audit_adapter.events[0]
    assert event["action"] == "fair_stand.catalog_category.created"
    assert event["resource_type"] == "catalog_category"
    assert event["resource_id"] == str(created.json()["id"])
    assert event["organization_id"] == organization_id
    assert event["access_token"] == _bearer(auth_headers)
    assert event["new_values"] == {"catalog_name": "QA", "catalog_index": 90, "is_active": True}
    assert event["metadata"]["source"] == "fair_stand"
    assert event["metadata"]["scope"] == "system_catalog"

    archived = client.post(
        f"/api/v1/fair-stand/admin/categories/{created.json()['id']}/archive",
        headers=auth_headers,
    )
    assert archived.status_code == 200, archived.text
    assert audit_adapter.events[-1]["action"] == "fair_stand.catalog_category.archived"
    assert audit_adapter.events[-1]["new_values"] is None


def test_failed_admin_mutation_records_nothing(client, db_session, auth_headers, audit_adapter):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    missing = client.patch(
        "/api/v1/fair-stand/admin/categories/999999",
        json={"catalog_name": "Yok"},
        headers=auth_headers,
    )
    assert missing.status_code == 404
    assert audit_adapter.events == []


def test_rolled_back_mutation_never_reaches_core(db_session, audit_adapter):
    # Mutasyon SQL'i transaction'ı başlatır; audit yalnız o transaction commit olursa gider.
    db_session.execute(text("SELECT 1"))
    recorder = StandAuditRecorder(
        session=db_session,
        adapter=audit_adapter,
        organization_id=uuid4(),
        access_token="token",
    )
    recorder.record("fair_stand.unit.created", "unit", 1, scope="system_catalog")
    db_session.rollback()
    db_session.commit()
    assert audit_adapter.events == []

    db_session.execute(text("SELECT 1"))
    recorder.record("fair_stand.unit.updated", "unit", 1, scope="system_catalog")
    db_session.commit()
    assert [event["action"] for event in audit_adapter.events] == ["fair_stand.unit.updated"]
    db_session.commit()
    assert len(audit_adapter.events) == 1


def test_preview_markup_and_secret_like_fields_stay_out_of_audit(client, db_session, auth_headers, audit_adapter):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    markup = "<div class='x'>" + "a" * 500 + "</div>"
    created = client.post(
        "/api/v1/fair-stand/admin/previews",
        json={"display_name": "QA", "markup": markup, "css_code": ".x{}" * 100},
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    event = audit_adapter.events[-1]
    assert event["action"] == "fair_stand.catalog_preview.created"
    assert "markup" not in event["new_values"]
    assert "css_code" not in event["new_values"]
    assert {"markup", "css_code"} <= set(event["metadata"]["omitted_fields"])
    assert markup not in repr(event)


def test_sanitize_drops_secrets_nested_and_long_values():
    cleaned = sanitize_audit_values(
        {
            "name": "Panel",
            "count": 2,
            "visible": False,
            "api_key": "k",
            "password": "p",
            "hostKey": "h",
            "access_token": "t",
            "turn_credential": "c",
            "nested": {"secret": "s"},
            "parts": [1, 2],
            "long": "x" * 201,
        }
    )
    assert cleaned.values == {"name": "Panel", "count": 2, "visible": False}
    assert set(cleaned.omitted_fields) == {
        "api_key", "password", "hostKey", "access_token", "turn_credential", "nested", "parts", "long",
    }
    assert sanitize_audit_values(None).values is None


def test_project_delete_records_identity_only(client, auth_headers, organization_id, audit_adapter, tmp_path, monkeypatch):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()
    created = client.post(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        json={"name": "Gizli Müşteri Standı", "customerId": CUSTOMER_ID, "payload": {"stand": {}, "modules": []}},
    )
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    assert audit_adapter.events == []

    deleted = client.delete(f"/api/v1/fair-stand/projects/{project_id}", headers=auth_headers)
    assert deleted.status_code == 204
    assert len(audit_adapter.events) == 1
    event = audit_adapter.events[0]
    assert event["action"] == "fair_stand.project.deleted"
    assert event["resource_type"] == "project"
    assert event["resource_id"] == project_id
    assert event["organization_id"] == organization_id
    assert event["metadata"]["scope"] == "organization"
    assert event["new_values"] is None and event["old_values"] is None
    assert "Gizli" not in repr(event) and CUSTOMER_ID not in repr(event)

    missing = client.delete(f"/api/v1/fair-stand/projects/{uuid4()}", headers=auth_headers)
    assert missing.status_code == 404
    assert len(audit_adapter.events) == 1


class _FakeCoreHttp:
    def __init__(self, *, status_code: int = 201, error: Exception | None = None) -> None:
        self.status_code = status_code
        self.error = error
        self.requests: list[dict] = []

    def request(self, method, path, *, access_token, organization_id, json=None):
        self.requests.append({"method": method, "path": path, "token": access_token, "org": organization_id, "json": json})
        if self.error is not None:
            raise self.error
        return SimpleNamespace(status_code=self.status_code, text="Core said secret-ish things")


def test_http_adapter_posts_to_core_audit_events():
    http = _FakeCoreHttp()
    organization_id = uuid4()
    HttpAuditAdapter(http_client=http).record_event(
        organization_id=organization_id,
        access_token="bearer-value",
        action="fair_stand.unit.created",
        resource_type="unit",
        resource_id="1",
        new_values={"name": "Adet"},
        metadata={"source": "fair_stand", "scope": "system_catalog"},
    )
    assert http.requests == [
        {
            "method": "POST",
            "path": f"/api/v1/organizations/{organization_id}/audit-events",
            "token": "bearer-value",
            "org": organization_id,
            "json": {
                "action": "fair_stand.unit.created",
                "resource_type": "unit",
                "resource_id": "1",
                "old_values": None,
                "new_values": {"name": "Adet"},
                "metadata": {"source": "fair_stand", "scope": "system_catalog"},
            },
        }
    ]


def _adapter_factory(adapter):
    def factory():
        return adapter

    return factory


def test_core_audit_failure_is_best_effort_and_never_logs_token(
    client, db_session, auth_headers, caplog,
):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    token = _bearer(auth_headers)
    for http in (_FakeCoreHttp(error=httpx.ConnectError(f"refused {token}")), _FakeCoreHttp(status_code=500)):
        app.dependency_overrides[get_audit_adapter] = _adapter_factory(HttpAuditAdapter(http_client=http))
        with caplog.at_level(logging.DEBUG):
            created = client.post(
                "/api/v1/fair-stand/admin/units",
                json={"name": f"Birim {uuid4().hex[:6]}", "symbol": "b"},
                headers=auth_headers,
            )
        assert created.status_code == 201, created.text
        assert len(http.requests) == 1
    assert "Best-effort Core audit write failed" in caplog.text
    assert token not in caplog.text
    assert "secret-ish" not in caplog.text


def test_dev_bypass_uses_no_op_audit(monkeypatch):
    monkeypatch.setattr(dependencies_module, "dev_bypass_enabled", lambda: True)
    assert isinstance(get_audit_adapter(), NoOpAuditAdapter)
    monkeypatch.setattr(dependencies_module, "dev_bypass_enabled", lambda: False)
    assert isinstance(get_audit_adapter(), HttpAuditAdapter)

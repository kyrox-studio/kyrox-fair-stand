"""Oturumsuz demo: süre sayacı, çerez/IP kotası ve süzülmüş katalog (ADR-0012)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.modules.fair_stand.application.demo_access import (
    DemoAccessError,
    DemoAccessService,
    new_browser_id,
    normalize_ip,
    resolve_client_ip,
)
from app.modules.fair_stand.infrastructure.models import FairStandDemoUsageModel
from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog

DEMO = "/api/v1/fair-stand/demo"
T0 = datetime(2026, 11, 9, 9, 0, tzinfo=UTC)


def _settings(**overrides) -> Settings:
    values = {
        "demo_enabled": True,
        "demo_secret": "test-demo-secret",
        "demo_minutes_per_day": 25,
        "demo_ip_multiplier": 3,
        "demo_heartbeat_seconds": 30,
        "demo_trusted_proxies": "127.0.0.1,::1,testclient",
    }
    values.update(overrides)
    return Settings(**values)


def _beat(db_session, settings, *, ip, browser, start, seconds, step=30):
    """`seconds` boyunca `step` aralıkla sinyal; son durumu döner."""
    status = None
    t = start
    for _ in range(seconds // step):
        t = t + timedelta(seconds=step)
        status = DemoAccessService(db_session, settings, now=t).heartbeat(ip=ip, browser_id=browser)
    return status, t


@pytest.fixture
def demo_env(monkeypatch):
    monkeypatch.setenv("FAIR_STAND_DEMO_ENABLED", "true")
    monkeypatch.setenv("FAIR_STAND_DEMO_SECRET", "test-demo-secret")
    monkeypatch.setenv("FAIR_STAND_DEMO_TRUSTED_PROXIES", "testclient")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


# --- servis kuralları ---------------------------------------------------------------


def test_demo_disabled_without_secret(db_session):
    with pytest.raises(DemoAccessError) as exc:
        DemoAccessService(db_session, _settings(demo_secret="  "))
    assert exc.value.status_code == 404
    with pytest.raises(DemoAccessError):
        DemoAccessService(db_session, _settings(demo_enabled=False))


def test_start_does_not_spend_time_and_reports_full_limit(db_session):
    status = DemoAccessService(db_session, _settings(), now=T0).start(ip="1.2.3.4", browser_id=new_browser_id())
    assert status.remaining_seconds == 25 * 60
    assert status.limit_seconds == 25 * 60
    assert status.heartbeat_seconds == 30


def test_browser_expires_after_25_minutes(db_session):
    settings = _settings()
    browser = new_browser_id()
    DemoAccessService(db_session, settings, now=T0).start(ip="1.2.3.4", browser_id=browser)
    status, t = _beat(db_session, settings, ip="1.2.3.4", browser=browser, start=T0, seconds=24 * 60)
    assert status.remaining_seconds == 60
    with pytest.raises(DemoAccessError) as exc:
        _beat(db_session, settings, ip="1.2.3.4", browser=browser, start=t, seconds=60)
    assert exc.value.code == "demo_expired"
    with pytest.raises(DemoAccessError):
        DemoAccessService(db_session, settings, now=t).require_active(ip="1.2.3.4", browser_id=browser)


def test_gap_between_beats_is_capped(db_session):
    """Sekme gizlenip sinyal durursa geçen saatler sayılmaz; en çok 1,5 × sinyal aralığı."""
    settings = _settings()
    browser = new_browser_id()
    DemoAccessService(db_session, settings, now=T0).start(ip="1.2.3.4", browser_id=browser)
    status = DemoAccessService(db_session, settings, now=T0 + timedelta(hours=3)).heartbeat(
        ip="1.2.3.4", browser_id=browser
    )
    assert status.remaining_seconds == 25 * 60 - 45


def test_new_cookie_same_ip_hits_ip_quota(db_session):
    """Çerez silmek yeni tarayıcı kotası verir ama IP kotası (3 × 25 dk) tükenince biter."""
    settings = _settings()
    t = T0
    for _ in range(3):
        browser = new_browser_id()
        DemoAccessService(db_session, settings, now=t).start(ip="5.6.7.8", browser_id=browser)
        with pytest.raises(DemoAccessError):
            _, t = _beat(db_session, settings, ip="5.6.7.8", browser=browser, start=t, seconds=26 * 60)
        t = t + timedelta(minutes=26)
    fourth = new_browser_id()
    status = DemoAccessService(db_session, settings, now=t).start(ip="5.6.7.8", browser_id=fourth)
    assert status.remaining_seconds == 0


def test_same_cookie_new_ip_stays_expired(db_session):
    settings = _settings()
    browser = new_browser_id()
    DemoAccessService(db_session, settings, now=T0).start(ip="1.1.1.1", browser_id=browser)
    with pytest.raises(DemoAccessError):
        _beat(db_session, settings, ip="1.1.1.1", browser=browser, start=T0, seconds=26 * 60)
    status = DemoAccessService(db_session, settings, now=T0 + timedelta(minutes=30)).start(
        ip="9.9.9.9", browser_id=browser
    )
    assert status.remaining_seconds == 0


def test_window_resets_after_24_hours(db_session):
    settings = _settings()
    browser = new_browser_id()
    DemoAccessService(db_session, settings, now=T0).start(ip="1.2.3.4", browser_id=browser)
    with pytest.raises(DemoAccessError):
        _beat(db_session, settings, ip="1.2.3.4", browser=browser, start=T0, seconds=26 * 60)
    status = DemoAccessService(db_session, settings, now=T0 + timedelta(hours=24, minutes=1)).start(
        ip="1.2.3.4", browser_id=browser
    )
    assert status.remaining_seconds == 25 * 60


def test_raw_ip_and_cookie_are_not_stored(db_session):
    settings = _settings()
    browser = new_browser_id()
    DemoAccessService(db_session, settings, now=T0).start(ip="203.0.113.7", browser_id=browser)
    db_session.flush()
    rows = db_session.execute(select(FairStandDemoUsageModel)).scalars().all()
    assert {row.subject_kind for row in rows} == {"browser", "ip"}
    for row in rows:
        assert "203.0.113.7" not in row.subject_hash
        assert browser not in row.subject_hash
        assert len(row.subject_hash) == 64


def test_stale_rows_are_purged(db_session):
    settings = _settings()
    DemoAccessService(db_session, settings, now=T0).start(ip="1.2.3.4", browser_id=new_browser_id())
    db_session.flush()
    DemoAccessService(db_session, settings, now=T0 + timedelta(hours=49)).start(
        ip="4.3.2.1", browser_id=new_browser_id()
    )
    db_session.flush()
    assert len(db_session.execute(select(FairStandDemoUsageModel)).scalars().all()) == 2


def test_real_ip_header_only_from_trusted_proxy():
    settings = _settings(demo_trusted_proxies="127.0.0.1")
    assert resolve_client_ip("127.0.0.1", "198.51.100.4", settings) == "198.51.100.4"
    assert resolve_client_ip("198.51.100.9", "1.1.1.1", settings) == "198.51.100.9"


def test_ipv6_uses_64_prefix():
    assert normalize_ip("2001:db8:1:2:aaaa::1") == normalize_ip("2001:db8:1:2:bbbb::9")
    assert normalize_ip("2001:db8:1:3::1") != normalize_ip("2001:db8:1:2::1")
    assert normalize_ip("::ffff:192.0.2.1") == "192.0.2.1"


# --- HTTP uçları ----------------------------------------------------------------------


def test_demo_endpoints_404_when_disabled(client):
    assert client.post(f"{DEMO}/session").status_code == 404
    assert client.get(f"{DEMO}/catalog/bootstrap").status_code == 404


def test_session_sets_httponly_cookie(client, demo_env):
    response = client.post(f"{DEMO}/session", headers={"X-Real-IP": "198.51.100.20"})
    assert response.status_code == 200
    assert response.json() == {"remainingSeconds": 1500, "limitSeconds": 1500, "heartbeatSeconds": 30}
    cookie = response.headers["set-cookie"]
    assert "fs_demo_id=" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/api/v1/fair-stand/demo" in cookie
    assert "SameSite=strict" in cookie
    assert response.headers["cache-control"] == "no-store"


def test_heartbeat_and_catalog_require_demo_cookie(client, demo_env):
    assert client.post(f"{DEMO}/heartbeat").json() == {"detail": "demo_session_required"}
    assert client.get(f"{DEMO}/catalog/bootstrap").status_code == 401


def test_demo_catalog_strips_bom_only_fields(client, db_session, demo_env, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    real = client.get("/api/v1/fair-stand/catalog/bootstrap", headers=auth_headers).json()
    assert any("lengthParts" in item for item in real["items"])

    client.post(f"{DEMO}/session")
    response = client.get(f"{DEMO}/catalog/bootstrap")
    assert response.status_code == 200
    demo = response.json()
    assert len(demo["items"]) == len(real["items"])
    assert all("lengthParts" not in item and "isCostEnabled" not in item for item in demo["items"])
    assert demo["settings"]["exportButtonVisible"] is True
    assert demo["settings"]["importButtonVisible"] is True
    assert demo["settings"]["saveAsButtonVisible"] is True
    assert demo["boothTypes"] == real["boothTypes"]


def test_demo_cookie_does_not_open_real_endpoints(client, demo_env):
    client.post(f"{DEMO}/session")
    assert client.get("/api/v1/fair-stand/catalog/bootstrap").status_code in {401, 422}
    assert client.get("/api/v1/fair-stand/projects").status_code in {401, 422}
    assert client.get("/api/v1/fair-stand/group-templates").status_code in {401, 422}
    assert client.get("/api/v1/fair-stand/cost-items").status_code in {401, 422}
    assert client.post("/api/v1/fair-stand/live-shares").status_code in {401, 422}

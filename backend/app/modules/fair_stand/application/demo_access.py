"""Oturumsuz demo erişimi ve süre sayacı (ADR-0012).

Kural: aynı tarayıcı 24 saatte ``demo_minutes_per_day`` dakika, aynı IP bunun
``demo_ip_multiplier`` katı kadar aktif kullanım alır. Kalan süre iki sayacın en küçüğüdür;
çerez silmek IP sayacını, IP değiştirmek çerez sayacını sıfırlamaz.

Süre yalnız sunucuya gelen canlılık sinyaliyle (heartbeat) artar. Bir sinyal, önceki
sinyalden bu yana geçen süreyi en çok ``1,5 × heartbeat`` kadar sayar; sekme gizlenip
sinyal durunca süre neredeyse işlemez.

Ham IP ve çerez değeri saklanmaz; yalnız ``demo_secret`` ile HMAC-SHA256 özeti tutulur.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.fair_stand.infrastructure.models import FairStandDemoUsageModel

DEMO_WINDOW = timedelta(hours=24)
DEMO_ROW_RETENTION = timedelta(hours=48)
BROWSER_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")

# Demo kataloğunda yalnız BOM / maliyet için kullanılan Item alanları çıkarılır.
# `composition` sahne, snap ve montaj için de okunduğu için çıkarılamaz (ADR-0012).
DEMO_STRIPPED_ITEM_FIELDS = ("lengthParts", "isCostEnabled")


class DemoAccessError(Exception):
    def __init__(self, status_code: int, code: str) -> None:
        super().__init__(code)
        self.status_code = status_code
        self.code = code


@dataclass(frozen=True)
class DemoStatus:
    remaining_seconds: int
    limit_seconds: int
    heartbeat_seconds: int

    def payload(self) -> dict[str, int]:
        return {
            "remainingSeconds": self.remaining_seconds,
            "limitSeconds": self.limit_seconds,
            "heartbeatSeconds": self.heartbeat_seconds,
        }


def demo_is_enabled(settings: Settings) -> bool:
    return bool(settings.demo_enabled and settings.demo_secret.strip())


def new_browser_id() -> str:
    return secrets.token_urlsafe(32)


def is_valid_browser_id(value: str | None) -> bool:
    return bool(value and BROWSER_ID_PATTERN.match(value))


def normalize_ip(value: str) -> str:
    """IPv6 için /64 ön eki kullanılır; aynı hat içindeki adres değişimi yeni kota vermez."""
    try:
        address = ipaddress.ip_address(value.strip())
    except ValueError:
        return value.strip() or "unknown"
    if isinstance(address, ipaddress.IPv6Address):
        if address.ipv4_mapped is not None:
            return str(address.ipv4_mapped)
        return str(ipaddress.ip_network(f"{address}/64", strict=False).network_address) + "/64"
    return str(address)


def resolve_client_ip(peer_host: str | None, real_ip_header: str | None, settings: Settings) -> str:
    """Yalnız güvenilen vekilden (Nginx) gelen ``X-Real-IP`` kabul edilir."""
    trusted = {entry.strip() for entry in settings.demo_trusted_proxies.split(",") if entry.strip()}
    peer = (peer_host or "").strip()
    if peer in trusted and real_ip_header and real_ip_header.strip():
        return normalize_ip(real_ip_header)
    return normalize_ip(peer)


def strip_demo_catalog(payload: dict) -> dict:
    items = []
    for item in payload.get("items", []):
        items.append({key: value for key, value in item.items() if key not in DEMO_STRIPPED_ITEM_FIELDS})
    settings = dict(payload.get("settings") or {})
    # Demo düğmeleri gösterir ve her birinde oturum mesajı verir; ayar gizlemesin.
    settings.update(
        {
            "exportButtonVisible": True,
            "importButtonVisible": True,
            "saveAsButtonVisible": True,
        }
    )
    return {**payload, "items": items, "settings": settings}


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


class DemoAccessService:
    def __init__(self, session: Session, settings: Settings, now: datetime | None = None) -> None:
        if not demo_is_enabled(settings):
            raise DemoAccessError(404, "demo_disabled")
        self._session = session
        self._settings = settings
        self._now = now or datetime.now(tz=UTC)

    @property
    def browser_limit_seconds(self) -> int:
        return int(self._settings.demo_minutes_per_day) * 60

    @property
    def ip_limit_seconds(self) -> int:
        return self.browser_limit_seconds * int(self._settings.demo_ip_multiplier)

    @property
    def max_credit_seconds(self) -> int:
        return int(self._settings.demo_heartbeat_seconds * 3 // 2)

    def _hash(self, kind: str, value: str) -> str:
        key = self._settings.demo_secret.encode("utf-8")
        return hmac.new(key, f"{kind}:{value}".encode("utf-8"), hashlib.sha256).hexdigest()

    def _load(self, kind: str, value: str) -> FairStandDemoUsageModel:
        subject_hash = self._hash(kind, value)
        query = (
            select(FairStandDemoUsageModel)
            .where(
                FairStandDemoUsageModel.subject_kind == kind,
                FairStandDemoUsageModel.subject_hash == subject_hash,
            )
            .with_for_update()
        )
        row = self._session.execute(query).scalar_one_or_none()
        if row is None:
            row = FairStandDemoUsageModel(
                subject_kind=kind,
                subject_hash=subject_hash,
                window_started_at=self._now,
                last_seen_at=self._now,
                used_seconds=0,
            )
            try:
                with self._session.begin_nested():
                    self._session.add(row)
                    self._session.flush()
            except IntegrityError:
                row = self._session.execute(query).scalar_one()
        if self._now - _aware(row.window_started_at) >= DEMO_WINDOW:
            row.window_started_at = self._now
            row.last_seen_at = self._now
            row.used_seconds = 0
        return row

    def _credit(self, row: FairStandDemoUsageModel) -> None:
        elapsed = (self._now - _aware(row.last_seen_at)).total_seconds()
        credit = max(0, min(int(elapsed), self.max_credit_seconds))
        row.used_seconds = int(row.used_seconds) + credit
        row.last_seen_at = self._now

    def _status(self, browser: FairStandDemoUsageModel, ip: FairStandDemoUsageModel) -> DemoStatus:
        remaining = min(
            self.browser_limit_seconds - int(browser.used_seconds),
            self.ip_limit_seconds - int(ip.used_seconds),
        )
        return DemoStatus(
            remaining_seconds=max(0, remaining),
            limit_seconds=self.browser_limit_seconds,
            heartbeat_seconds=int(self._settings.demo_heartbeat_seconds),
        )

    def _purge_stale(self) -> None:
        self._session.execute(
            delete(FairStandDemoUsageModel).where(
                FairStandDemoUsageModel.last_seen_at < self._now - DEMO_ROW_RETENTION
            )
        )

    def start(self, *, ip: str, browser_id: str) -> DemoStatus:
        """Sayfa açılışı: süre saymaz, sayaçları başlatır. Süre dolmuşsa da durumu döner."""
        self._purge_stale()
        browser = self._load("browser", browser_id)
        ip_row = self._load("ip", ip)
        # Açılış anı bir sinyal sayılmaz; önceki kapanıştan bu yana geçen süre yazılmaz.
        # IP satırına dokunulmaz: aynı IP'de başka tarayıcı sinyal gönderiyor olabilir.
        browser.last_seen_at = self._now
        return self._status(browser, ip_row)

    def heartbeat(self, *, ip: str, browser_id: str) -> DemoStatus:
        browser = self._load("browser", browser_id)
        ip_row = self._load("ip", ip)
        self._credit(browser)
        self._credit(ip_row)
        status = self._status(browser, ip_row)
        if status.remaining_seconds <= 0:
            raise DemoAccessError(403, "demo_expired")
        return status

    def require_active(self, *, ip: str, browser_id: str) -> DemoStatus:
        status = self._status(self._load("browser", browser_id), self._load("ip", ip))
        if status.remaining_seconds <= 0:
            raise DemoAccessError(403, "demo_expired")
        return status

from collections.abc import Generator
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.modules.fair_stand.api.dependencies import (
    get_audit_adapter,
    get_authorization_adapter,
    get_core_http_client,
)
from app.modules.fair_stand.infrastructure import models as _fair_stand_models  # noqa: F401
from app.integrations.kyrox_core.ports import AuthorizationPort


class AllowAllAuthorization(AuthorizationPort):
    def check_permission(self, **kwargs) -> bool:
        _ = kwargs
        return True


class FakeCoreHttp:
    def request(self, *args, **kwargs):
        _ = (args, kwargs)
        return SimpleNamespace(status_code=200)


class RecordingAuditAdapter:
    """Core audit stand-in: keeps every event the app would send (D-18)."""

    def __init__(self) -> None:
        self.events: list[dict] = []

    def record_event(self, **kwargs) -> None:
        self.events.append(kwargs)


def create_test_token(*, user_id: UUID, email: str = "test@example.com") -> str:
    settings = get_settings()
    now = datetime.now(tz=UTC)
    payload = {
        "sub": str(user_id),
        "email": email,
        "sid": str(uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(now.timestamp()) + 3600,
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


@pytest.fixture
def test_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _fk(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(test_engine) -> Generator[Session, None, None]:
    connection = test_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def organization_id() -> UUID:
    return uuid4()


@pytest.fixture
def user_id() -> UUID:
    return uuid4()


@pytest.fixture
def auth_headers(user_id: UUID, organization_id: UUID) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {create_test_token(user_id=user_id)}",
        "X-Organization-Id": str(organization_id),
    }


@pytest.fixture
def audit_adapter() -> RecordingAuditAdapter:
    return RecordingAuditAdapter()


@pytest.fixture
def client(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    audit_adapter: RecordingAuditAdapter,
) -> TestClient:
    monkeypatch.setenv("FAIR_STAND_DEV_BYPASS_CORE", "false")
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session
        db_session.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_authorization_adapter] = lambda: AllowAllAuthorization()
    app.dependency_overrides[get_core_http_client] = lambda: FakeCoreHttp()
    app.dependency_overrides[get_audit_adapter] = lambda: audit_adapter
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()

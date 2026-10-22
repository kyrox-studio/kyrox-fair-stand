"""Core yetki sorgusu hata verirse API 500 dönmez: oturum geçersiz → 401, Core hatası → 503."""

from __future__ import annotations

import pytest

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.integrations.kyrox_core.ports import AuthorizationPort
from app.main import app
from app.modules.fair_stand.api.dependencies import get_authorization_adapter


class RaisingAuthorization(AuthorizationPort):
    def __init__(self, error: Exception) -> None:
        self.error = error

    def check_permission(self, **kwargs) -> bool:
        raise self.error


@pytest.mark.parametrize(
    ("error", "status_code", "detail"),
    [
        (UnauthorizedError("Session is not valid in Kyrox Core"), 401, "Not authenticated"),
        (ForbiddenError("Authorization check failed"), 503, "Authorization check failed"),
    ],
)
def test_core_authorization_errors_map_to_http_status(client, auth_headers, error, status_code, detail):
    previous = app.dependency_overrides.get(get_authorization_adapter)
    app.dependency_overrides[get_authorization_adapter] = lambda: RaisingAuthorization(error)
    try:
        response = client.get("/api/v1/fair-stand/projects", headers=auth_headers)
    finally:
        app.dependency_overrides[get_authorization_adapter] = previous
    assert response.status_code == status_code
    assert response.json() == {"detail": detail}

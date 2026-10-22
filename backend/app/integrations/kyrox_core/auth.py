from dataclasses import dataclass
from uuid import UUID

import jwt

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.integrations.kyrox_core.ports import AuthContext


@dataclass(frozen=True)
class TokenClaims:
    user_id: UUID
    email: str
    session_id: UUID


def decode_access_token(token: str) -> TokenClaims:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Invalid or expired token") from exc
    try:
        return TokenClaims(
            user_id=UUID(payload["sub"]),
            email=payload["email"],
            session_id=UUID(payload["sid"]),
        )
    except (KeyError, ValueError, TypeError) as exc:
        raise UnauthorizedError("Invalid token claims") from exc


def build_auth_context(token: str, organization_id: UUID) -> AuthContext:
    claims = decode_access_token(token)
    return AuthContext(
        user_id=claims.user_id,
        email=claims.email,
        session_id=claims.session_id,
        organization_id=organization_id,
    )

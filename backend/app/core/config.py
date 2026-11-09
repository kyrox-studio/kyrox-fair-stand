from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    database_url: str = Field(
        default="postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/fair_stand",
        validation_alias=AliasChoices("FAIR_STAND_DATABASE_URL", "DATABASE_URL"),
    )
    jwt_secret_key: str = "change-me-in-production-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    kyrox_core_base_url: str = "http://127.0.0.1:8000"
    app_env: str = "development"
    log_level: str = "INFO"
    host: str = "127.0.0.1"
    port: int = 8002
    dev_bypass_core: bool = Field(default=False, validation_alias="FAIR_STAND_DEV_BYPASS_CORE")
    dev_bypass_token: str = Field(default="dev-bypass", validation_alias="FAIR_STAND_DEV_BYPASS_TOKEN")
    dev_user_email: str = Field(default="dev@example.com", validation_alias="FAIR_STAND_DEV_USER_EMAIL")
    dev_user_id: str | None = Field(default=None, validation_alias="FAIR_STAND_DEV_USER_ID")
    project_asset_root: Path = Field(
        default=_BACKEND_ROOT / "var" / "project-assets",
        validation_alias=AliasChoices("FAIR_STAND_PROJECT_ASSET_ROOT", "PROJECT_ASSET_ROOT"),
    )
    live_share_stun_urls: str = Field(
        default="stun:stun.l.google.com:19302",
        validation_alias="FAIR_STAND_LIVE_SHARE_STUN_URLS",
    )
    live_share_turn_urls: str = Field(default="", validation_alias="FAIR_STAND_LIVE_SHARE_TURN_URLS")
    live_share_turn_username: str = Field(default="", validation_alias="FAIR_STAND_LIVE_SHARE_TURN_USERNAME")
    live_share_turn_credential: str = Field(default="", validation_alias="FAIR_STAND_LIVE_SHARE_TURN_CREDENTIAL")
    # Oturumsuz demo (ADR-0012). Gizli anahtar boşsa demo kapalıdır (fail-closed).
    demo_enabled: bool = Field(default=False, validation_alias="FAIR_STAND_DEMO_ENABLED")
    demo_secret: str = Field(default="", validation_alias="FAIR_STAND_DEMO_SECRET")
    demo_minutes_per_day: int = Field(default=25, ge=1, le=1440, validation_alias="FAIR_STAND_DEMO_MINUTES")
    demo_ip_multiplier: int = Field(default=3, ge=1, le=50, validation_alias="FAIR_STAND_DEMO_IP_MULTIPLIER")
    demo_heartbeat_seconds: int = Field(default=30, ge=5, le=300, validation_alias="FAIR_STAND_DEMO_HEARTBEAT_SECONDS")
    demo_trusted_proxies: str = Field(default="127.0.0.1,::1", validation_alias="FAIR_STAND_DEMO_TRUSTED_PROXIES")



@lru_cache
def get_settings() -> Settings:
    return Settings()

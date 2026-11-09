"""Oturumsuz demo uçları (ADR-0012).

Bu router Core oturumu istemez ve hiçbir proje, şablon, maliyet, paylaşım ya da admin
verisine dokunmaz. Tek veri çıkışı süzülmüş katalogdur. Diğer uçlar demo çerezini kabul
etmez; onlar yine Core JWT ister.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.modules.fair_stand.api.dependencies import get_catalog_bootstrap_use_case
from app.modules.fair_stand.api.routes import catalog_bootstrap_payload
from app.modules.fair_stand.application.demo_access import (
    DEMO_WINDOW,
    DemoAccessError,
    DemoAccessService,
    is_valid_browser_id,
    new_browser_id,
    resolve_client_ip,
    strip_demo_catalog,
)
from app.modules.fair_stand.application.get_catalog_bootstrap import GetCatalogBootstrapUseCase

router = APIRouter(prefix="/fair-stand/demo", tags=["fair-stand-demo"])

DEMO_COOKIE = "fs_demo_id"
DEMO_COOKIE_PATH = "/api/v1/fair-stand/demo"
DEMO_COOKIE_MAX_AGE = int(DEMO_WINDOW.total_seconds()) * 7
NO_STORE = {"Cache-Control": "no-store"}


def _client_ip(request: Request, settings: Settings) -> str:
    peer = request.client.host if request.client else None
    return resolve_client_ip(peer, request.headers.get("x-real-ip"), settings)


def _is_https(request: Request) -> bool:
    forwarded = request.headers.get("x-forwarded-proto", "")
    return request.url.scheme == "https" or forwarded.lower() == "https"


def _error(exc: DemoAccessError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.code}, headers=NO_STORE)


def _existing_browser_id(request: Request) -> str | None:
    value = request.cookies.get(DEMO_COOKIE)
    return value if is_valid_browser_id(value) else None


@router.post("/session")
def start_demo_session(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        service = DemoAccessService(db, settings)
    except DemoAccessError as exc:
        return _error(exc)
    browser_id = _existing_browser_id(request) or new_browser_id()
    status = service.start(ip=_client_ip(request, settings), browser_id=browser_id)
    response = JSONResponse(content=status.payload(), headers=NO_STORE)
    response.set_cookie(
        DEMO_COOKIE,
        browser_id,
        max_age=DEMO_COOKIE_MAX_AGE,
        path=DEMO_COOKIE_PATH,
        httponly=True,
        secure=_is_https(request),
        samesite="strict",
    )
    return response


@router.post("/heartbeat")
def demo_heartbeat(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        service = DemoAccessService(db, settings)
        browser_id = _existing_browser_id(request)
        if browser_id is None:
            raise DemoAccessError(401, "demo_session_required")
        status = service.heartbeat(ip=_client_ip(request, settings), browser_id=browser_id)
    except DemoAccessError as exc:
        # JSONResponse döner, istisna fırlatmaz: süre yazımı get_db ile commit edilir.
        return _error(exc)
    return JSONResponse(content=status.payload(), headers=NO_STORE)


@router.get("/catalog/bootstrap")
def get_demo_catalog_bootstrap(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    use_case: GetCatalogBootstrapUseCase = Depends(get_catalog_bootstrap_use_case),
) -> Response:
    try:
        service = DemoAccessService(db, settings)
        browser_id = _existing_browser_id(request)
        if browser_id is None:
            raise DemoAccessError(401, "demo_session_required")
        service.require_active(ip=_client_ip(request, settings), browser_id=browser_id)
    except DemoAccessError as exc:
        return _error(exc)
    payload: dict[str, Any] = strip_demo_catalog(catalog_bootstrap_payload(use_case.execute()))
    return JSONResponse(content=payload, headers=NO_STORE)

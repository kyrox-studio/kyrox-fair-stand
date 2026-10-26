"""Signaling only. This router never reads or writes a project."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, status
from pydantic import BaseModel, ConfigDict, Field
from starlette.websockets import WebSocketDisconnect

from app.integrations.kyrox_core.auth import AuthContext
from app.modules.fair_stand.api.dependencies import (
    PERMISSION_PROJECTS_CREATE,
    PERMISSION_PROJECTS_UPDATE,
    require_any_permission,
)
from app.modules.fair_stand.application.live_share import (
    VIEWER_OCCUPIED_MESSAGE,
    LiveShareRegistry,
    LiveShareSession,
    build_ice_servers,
    get_live_share_registry,
)

router = APIRouter(prefix="/fair-stand", tags=["fair-stand-live-share"])

_ERROR_MESSAGES = {
    "invalid": "Bu canlı paylaşım linki geçersiz.",
    "expired": "Bu canlı paylaşımın süresi doldu.",
    "revoked": "Yayın sona erdi",
    "occupied": VIEWER_OCCUPIED_MESSAGE,
    "host-taken": "Bu canlı paylaşıma zaten bir yayıncı bağlı.",
    "forbidden": "Bu sinyal bu rol için kabul edilmez.",
}


class LiveShareCreatedResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    token: str
    watch_path: str = Field(alias="watchPath")
    host_key: str = Field(alias="hostKey")
    expires_at: datetime = Field(alias="expiresAt")


class LiveShareStopRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    host_key: str = Field(alias="hostKey")


def get_registry() -> LiveShareRegistry:
    return get_live_share_registry()


@router.post("/live-shares", response_model=LiveShareCreatedResponse)
def create_live_share(
    auth: AuthContext = Depends(require_any_permission(PERMISSION_PROJECTS_UPDATE, PERMISSION_PROJECTS_CREATE)),
    registry: LiveShareRegistry = Depends(get_registry),
) -> LiveShareCreatedResponse:
    _ = auth
    session = registry.create()
    return LiveShareCreatedResponse(
        token=session.token,
        watch_path=f"/stand/watch/{session.token}",
        host_key=session.host_key,
        expires_at=session.expires_at,
    )


@router.post("/live-shares/{token}/stop", status_code=status.HTTP_204_NO_CONTENT)
async def stop_live_share(
    token: str,
    body: LiveShareStopRequest,
    registry: LiveShareRegistry = Depends(get_registry),
) -> None:
    result, event = registry.stop(token, body.host_key)
    if result == "invalid":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_ERROR_MESSAGES["invalid"])
    if result == "forbidden":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_ERROR_MESSAGES["forbidden"])
    if event is not None:
        await _dispatch([event])
    if result != "stopped":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_ERROR_MESSAGES.get(result, _ERROR_MESSAGES["revoked"]))


@router.websocket("/live-shares/{token}/ws")
async def live_share_socket(
    websocket: WebSocket,
    token: str,
    role: str = Query(...),
    host_key: str | None = Query(default=None, alias="hostKey"),
    registry: LiveShareRegistry = Depends(get_registry),
) -> None:
    await websocket.accept()
    if role not in {"host", "viewer"}:
        await _reject(websocket, "forbidden")
        return

    session = registry.get(token)
    if session is None:
        await _reject(websocket, "invalid")
        return
    if role == "host" and not registry.host_key_matches(session, host_key):
        await _reject(websocket, "forbidden")
        return

    error = registry.attach_host(session, websocket) if role == "host" else registry.attach_viewer(session, websocket)
    if error:
        await _reject(websocket, error)
        return

    await _send(websocket, {
        "type": "joined",
        "role": role,
        "iceServers": build_ice_servers(),
        "viewerCount": 1 if session.viewer_ws is not None else 0,
    })
    if role == "viewer" and session.host_ws is not None:
        await _send(session.host_ws, {"type": "viewer-joined", "viewerCount": 1})

    try:
        while True:
            raw = await websocket.receive_text()
            if session.revoked:
                await _send_ended_to(websocket, session.end_reason or "revoked")
                break
            events = registry.sweep()
            await _dispatch(events)
            if session.revoked:
                break
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await _send(websocket, {"type": "error", "code": "forbidden", "message": _ERROR_MESSAGES["forbidden"]})
                continue
            if not isinstance(message, dict):
                continue
            kind = message.get("type")
            if kind == "heartbeat":
                registry.touch(session, role)
                await _send(websocket, {"type": "heartbeat"})
                continue
            if kind == "stop" and role == "host":
                event = registry.revoke(session, "stopped")
                await _dispatch([event])
                break
            if not _role_may_send(role, kind):
                await _send(websocket, {
                    "type": "error",
                    "code": "forbidden",
                    "message": "Viewer offer gönderemez." if kind == "offer" else _ERROR_MESSAGES["forbidden"],
                })
                continue
            registry.touch(session, role)
            await _forward(session, role, message)
    except WebSocketDisconnect:
        pass
    finally:
        if role == "host":
            event = registry.detach_host(session, websocket)
        else:
            event = registry.detach_viewer(session, websocket)
        if event:
            await _dispatch([event])


def _role_may_send(role: str, kind: object) -> bool:
    if kind == "ice":
        return True
    if role == "host" and kind == "offer":
        return True
    if role == "viewer" and kind == "answer":
        return True
    return False


async def _forward(session: LiveShareSession, role: str, message: dict) -> None:
    target = session.viewer_ws if role == "host" else session.host_ws
    if target is None:
        return
    payload = {"type": message.get("type")}
    if message.get("type") in {"offer", "answer"}:
        payload["sdp"] = message.get("sdp")
    elif message.get("type") == "ice":
        payload["candidate"] = message.get("candidate")
    else:
        return
    await _send(target, payload)


async def _dispatch(events: list[dict]) -> None:
    for event in events:
        if event.get("type") == "ended":
            reason = event.get("reason") or "revoked"
            await _send_ended_to(event.get("host"), reason)
            await _send_ended_to(event.get("viewer"), reason)
            await _close_quietly(event.get("host"))
            await _close_quietly(event.get("viewer"))
        elif event.get("type") == "viewer-stale":
            await _send(event.get("host"), {"type": "viewer-left", "viewerCount": 0})
            await _close_quietly(event.get("viewer"))
        elif event.get("type") == "viewer-left":
            await _send(event.get("host"), {"type": "viewer-left", "viewerCount": 0})


async def _reject(websocket: WebSocket, code: str) -> None:
    await _send(websocket, {"type": "error", "code": code, "message": _ERROR_MESSAGES.get(code, _ERROR_MESSAGES["forbidden"])})
    await _close_quietly(websocket, code=1008)


async def _send_ended_to(websocket: WebSocket | None, reason: str) -> None:
    await _send(websocket, {"type": "ended", "reason": reason})


async def _send(websocket: WebSocket | None, payload: dict) -> None:
    if websocket is None:
        return
    try:
        await websocket.send_json(payload)
    except Exception:
        return


async def _close_quietly(websocket: WebSocket | None, code: int = 1000) -> None:
    if websocket is None:
        return
    try:
        await websocket.close(code=code)
    except Exception:
        return


async def live_share_sweep_loop() -> None:
    registry = get_live_share_registry()
    while True:
        await asyncio.sleep(5)
        events = registry.sweep()
        if events:
            await _dispatch(events)

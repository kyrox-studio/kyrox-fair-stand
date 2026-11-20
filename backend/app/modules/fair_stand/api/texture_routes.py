"""Katalog dokuları (panel tipi vb.): admin yükler, Stand saklar ve sunar.

Kullanıcı kararı 2026-11-18: admin'den yüklenen dokular Stand tarafında saklanır. Dosyalar depo
dışındaki kalıcı klasördedir (`FAIR_STAND_CATALOG_TEXTURE_ROOT`, proje görselleriyle aynı düzen);
Item'ın `texture` görseli `uploads/textures/<ad>` yolunu tutar ve önyüz bu uçtan okur. Depodaki
hazır dokular (`public/textures/...`) olduğu gibi çalışmaya devam eder.
"""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.integrations.kyrox_core.audit import SCOPE_SYSTEM_CATALOG, StandAuditRecorder
from app.integrations.kyrox_core.auth import AuthContext
from app.modules.fair_stand.api.dependencies import PERMISSION_CATALOG_UPDATE, get_stand_audit, require_permission
from app.modules.fair_stand.api.project_routes import read_upload_limited
from app.modules.fair_stand.application.image_optimize import ImageOptimizeError, optimize_uploaded_image
from app.modules.fair_stand.infrastructure.asset_storage import read_asset_bytes, write_asset_bytes
from app.modules.fair_stand.infrastructure.runtime_settings_seed import MAX_IMAGE_UPLOAD_MB

router = APIRouter(prefix="/fair-stand", tags=["fair-stand-textures"])

TEXTURE_PATH_PREFIX = "uploads/textures/"
_TEXTURE_NAME = re.compile(r"^[0-9a-f]{32}\.(jpg|jpeg|png|webp)$")
_MEDIA_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def _texture_root():
    return get_settings().catalog_texture_root


@router.post("/admin/textures", status_code=status.HTTP_201_CREATED)
async def admin_upload_texture(
    auth: AuthContext = Depends(require_permission(PERMISSION_CATALOG_UPDATE)),
    audit: StandAuditRecorder = Depends(get_stand_audit),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Doku görseli yükler; dönen `relativePath` Item'ın `texture` görseline yazılır."""
    _ = auth
    max_bytes = MAX_IMAGE_UPLOAD_MB * 1024 * 1024
    raw = await read_upload_limited(file, max_bytes=max_bytes)
    try:
        optimized = await run_in_threadpool(
            optimize_uploaded_image,
            raw,
            content_type=file.content_type,
            max_upload_bytes=max_bytes,
        )
    except ImageOptimizeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    extension = optimized.extension.lstrip(".").lower()
    name = f"{uuid4().hex}.{extension}"
    await run_in_threadpool(write_asset_bytes, _texture_root(), name, optimized.content)
    relative_path = f"{TEXTURE_PATH_PREFIX}{name}"
    audit.record(
        "fair_stand.texture.uploaded",
        "texture",
        name,
        scope=SCOPE_SYSTEM_CATALOG,
        new_values={"relativePath": relative_path, "byteSize": len(optimized.content)},
    )
    return {
        "relativePath": relative_path,
        "mimeType": optimized.mime_type,
        "byteSize": len(optimized.content),
    }


@router.get("/textures/{file_name}")
def get_texture(file_name: str) -> Response:
    """Doku dosyası. Sahne dokusu tarayıcıda yetki başlığı olmadan yüklendiği için açık okunur;
    adlar rastgele, yalnız katalog dokusu sunulur (proje görselleri ayrı ve yetkili)."""
    match = _TEXTURE_NAME.match(file_name)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Texture not found")
    try:
        content = read_asset_bytes(_texture_root(), file_name)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Texture not found") from exc
    return Response(
        content=content,
        media_type=_MEDIA_TYPES[match.group(1)],
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )

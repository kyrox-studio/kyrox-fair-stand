from __future__ import annotations

import asyncio
import io
import struct
import zlib
from uuid import uuid4

import pytest
from fastapi import HTTPException
from starlette.datastructures import UploadFile
from PIL import Image

from app.integrations.kyrox_core.ports import AuthorizationPort
from app.modules.fair_stand.api.dependencies import get_authorization_adapter
from app.modules.fair_stand.api.project_routes import read_upload_limited

CUSTOMER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def _png_bytes(size: int = 64) -> bytes:
    image = Image.new("RGB", (size, size), color=(20, 120, 200))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _jpeg_bytes(width: int, height: int) -> bytes:
    image = Image.new("RGB", (width, height), color=(40, 80, 120))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85, optimize=True)
    return buffer.getvalue()


def test_list_create_get_update_delete_project(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()

    empty = client.get("/api/v1/fair-stand/projects", headers=auth_headers)
    assert empty.status_code == 200
    assert empty.json()["projects"] == []

    created = client.post(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        json={
            "name": "Demo Stand",
            "customerId": CUSTOMER_ID,
            "payload": {"stand": {"standType": "island"}, "modules": []},
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    project_id = body["id"]
    assert body["name"] == "Demo Stand"
    assert body["customerId"] == CUSTOMER_ID
    assert body["stand"]["standType"] == "island"
    assert body["modules"] == []

    listed = client.get("/api/v1/fair-stand/projects", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()["projects"]) == 1

    updated = client.put(
        f"/api/v1/fair-stand/projects/{project_id}",
        headers=auth_headers,
        json={
            "name": "Demo Stand 2",
            "payload": {
                "stand": {"standType": "inline"},
                "modules": [{"id": "m1", "type": "wall"}],
            },
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Demo Stand 2"
    assert updated.json()["customerId"] == CUSTOMER_ID
    assert updated.json()["modules"][0]["id"] == "m1"

    foreign = client.get(
        f"/api/v1/fair-stand/projects/{project_id}",
        headers={
            **auth_headers,
            "X-Organization-Id": str(uuid4()),
        },
    )
    assert foreign.status_code == 404

    deleted = client.delete(f"/api/v1/fair-stand/projects/{project_id}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/fair-stand/projects/{project_id}", headers=auth_headers).status_code == 404


def test_asset_upload_download_export(client, auth_headers, tmp_path, monkeypatch, organization_id):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()

    created = client.post(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        json={"name": "Asset Stand", "customerId": CUSTOMER_ID, "payload": {"stand": None, "modules": []}},
    )
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    asset_id = str(uuid4())

    upload = client.post(
        f"/api/v1/fair-stand/projects/{project_id}/assets",
        headers=auth_headers,
        data={"asset_id": asset_id, "name": "logo.png"},
        files={"file": ("logo.png", _png_bytes(2000), "image/png")},
    )
    assert upload.status_code == 201, upload.text
    asset = upload.json()
    assert asset["id"] == asset_id
    assert asset["type"] in {"image/webp", "image/jpeg", "image/png"}
    assert f"{organization_id}/{project_id}/{asset_id}" in asset["storageKey"]

    # Path uses UUID string form with hyphens
    key_path = tmp_path.joinpath(*asset["storageKey"].split("/"))
    assert key_path.is_file()
    assert key_path.stat().st_size > 0

    download = client.get(
        f"/api/v1/fair-stand/projects/{project_id}/assets/{asset_id}",
        headers=auth_headers,
    )
    assert download.status_code == 200
    assert download.content == key_path.read_bytes()

    export = client.get(
        f"/api/v1/fair-stand/projects/{project_id}/export",
        headers=auth_headers,
    )
    assert export.status_code == 200
    assert export.headers["content-type"].startswith("application/zip")
    assert len(export.content) > 0


def test_asset_upload_optimizes_high_pixel_jpeg_within_byte_limit(
    client, auth_headers, tmp_path, monkeypatch
):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()

    created = client.post(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        json={"name": "Huge JPEG", "customerId": CUSTOMER_ID, "payload": {"stand": None, "modules": []}},
    )
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    asset_id = str(uuid4())

    # 54 MP real camera-class image: below the Pillow-default pixel limit, within byte limit.
    image = Image.new("L", (9_000, 6_000), color=90)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    image.close()
    raw = buffer.getvalue()
    assert len(raw) < 5 * 1024 * 1024
    upload = client.post(
        f"/api/v1/fair-stand/projects/{project_id}/assets",
        headers=auth_headers,
        data={"asset_id": asset_id, "name": "banner.jpg"},
        files={"file": ("banner.jpg", raw, "image/jpeg")},
    )

    assert upload.status_code == 201, upload.text
    assert upload.json()["type"] in {"image/webp", "image/jpeg"}


def _create_project(client, auth_headers, name: str) -> str:
    created = client.post(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        json={"name": name, "customerId": CUSTOMER_ID, "payload": {"stand": None, "modules": []}},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _png_header_only(width: int, height: int) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 1, 0, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"")) + chunk(b"IEND", b"")


def test_asset_upload_rejects_png_above_pixel_limit(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()
    project_id = _create_project(client, auth_headers, "Pixel bomb")

    raw = _png_header_only(20_000, 20_000)  # 400 MP declared in under 1 KB
    upload = client.post(
        f"/api/v1/fair-stand/projects/{project_id}/assets",
        headers=auth_headers,
        data={"asset_id": str(uuid4()), "name": "bomb.png"},
        files={"file": ("bomb.png", raw, "image/png")},
    )
    assert upload.status_code == 400, upload.text
    assert "exceeds pixel limit" in upload.json()["detail"]
    assert not any(tmp_path.rglob("*.*"))


def test_asset_upload_stops_reading_once_byte_limit_exceeded(
    client, auth_headers, tmp_path, monkeypatch
):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()
    project_id = _create_project(client, auth_headers, "Oversize")

    read_bytes: list[int] = []
    real_read = UploadFile.read

    async def counting_read(self, size: int = -1) -> bytes:
        data = await real_read(self, size)
        read_bytes.append(len(data))
        return data

    monkeypatch.setattr(UploadFile, "read", counting_read)
    limit = 5 * 1024 * 1024  # max_image_upload_mb default (5)
    raw = b"\0" * (limit * 3)
    upload = client.post(
        f"/api/v1/fair-stand/projects/{project_id}/assets",
        headers=auth_headers,
        data={"asset_id": str(uuid4()), "name": "big.png"},
        files={"file": ("big.png", raw, "image/png")},
    )
    assert upload.status_code == 400, upload.text
    assert "exceeds upload limit" in upload.json()["detail"]
    assert sum(read_bytes) == limit + 1


def test_read_upload_limited_reads_at_most_limit_plus_one_byte():
    class FakeUpload:
        def __init__(self, total: int) -> None:
            self.remaining = total
            self.read_total = 0

        async def read(self, size: int = -1) -> bytes:
            n = self.remaining if size is None or size < 0 else min(size, self.remaining)
            self.remaining -= n
            self.read_total += n
            return b"x" * n

    oversized = FakeUpload(50 * 1024 * 1024)
    with pytest.raises(HTTPException) as caught:
        asyncio.run(read_upload_limited(oversized, max_bytes=1024 * 1024))
    assert caught.value.status_code == 400
    assert oversized.read_total == 1024 * 1024 + 1

    exact = FakeUpload(1024 * 1024)
    assert len(asyncio.run(read_upload_limited(exact, max_bytes=1024 * 1024))) == 1024 * 1024
    assert exact.read_total == 1024 * 1024


def test_asset_upload_decodes_off_the_event_loop(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings
    from app.modules.fair_stand.application.projects import ProjectService

    get_settings.cache_clear()
    project_id = _create_project(client, auth_headers, "Threadpool")

    on_event_loop: list[bool] = []
    real_upsert = ProjectService.upsert_asset

    def spy_upsert(self, **kwargs):
        try:
            asyncio.get_running_loop()
            on_event_loop.append(True)
        except RuntimeError:
            on_event_loop.append(False)
        return real_upsert(self, **kwargs)

    monkeypatch.setattr(ProjectService, "upsert_asset", spy_upsert)
    upload = client.post(
        f"/api/v1/fair-stand/projects/{project_id}/assets",
        headers=auth_headers,
        data={"asset_id": str(uuid4()), "name": "logo.png"},
        files={"file": ("logo.png", _png_bytes(), "image/png")},
    )
    assert upload.status_code == 201, upload.text
    assert on_event_loop == [False]


def test_asset_upload_auth_unchanged(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()
    project_id = _create_project(client, auth_headers, "Auth")
    files = {"file": ("logo.png", _png_bytes(), "image/png")}

    anonymous = client.post(
        f"/api/v1/fair-stand/projects/{project_id}/assets",
        headers={"X-Organization-Id": auth_headers["X-Organization-Id"]},
        files=files,
    )
    assert anonymous.status_code == 401

    class DenyAll(AuthorizationPort):
        def check_permission(self, **kwargs) -> bool:
            return False

    client.app.dependency_overrides[get_authorization_adapter] = lambda: DenyAll()
    denied = client.post(
        f"/api/v1/fair-stand/projects/{project_id}/assets",
        headers=auth_headers,
        files=files,
    )
    assert denied.status_code == 403
    assert not any(tmp_path.rglob("*.*"))


def test_put_upserts_missing_project(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()
    project_id = str(uuid4())

    updated = client.put(
        f"/api/v1/fair-stand/projects/{project_id}",
        headers=auth_headers,
        json={
            "name": "Upsert Stand",
            "customerId": CUSTOMER_ID,
            "payload": {"stand": {"standType": "island"}, "modules": []},
        },
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["id"] == project_id
    assert body["name"] == "Upsert Stand"
    assert body["customerId"] == CUSTOMER_ID

    again = client.put(
        f"/api/v1/fair-stand/projects/{project_id}",
        headers=auth_headers,
        json={"name": "Upsert Stand 2", "payload": {"stand": None, "modules": []}},
    )
    assert again.status_code == 200
    assert again.json()["name"] == "Upsert Stand 2"
    assert again.json()["customerId"] == CUSTOMER_ID


def test_asset_download_accepts_turkish_filename(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setenv("FAIR_STAND_PROJECT_ASSET_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()

    created = client.post(
        "/api/v1/fair-stand/projects",
        headers=auth_headers,
        json={"name": "Türkçe Proje", "customerId": CUSTOMER_ID, "payload": {"stand": None, "modules": []}},
    )
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    asset_id = str(uuid4())

    upload = client.post(
        f"/api/v1/fair-stand/projects/{project_id}/assets",
        headers=auth_headers,
        data={"asset_id": asset_id, "name": "tuğla-duvar.png"},
        files={"file": ("tuğla-duvar.png", _png_bytes(64), "image/png")},
    )
    assert upload.status_code == 201, upload.text

    download = client.get(
        f"/api/v1/fair-stand/projects/{project_id}/assets/{asset_id}",
        headers=auth_headers,
    )
    assert download.status_code == 200, download.text
    disposition = download.headers.get("content-disposition", "")
    assert "filename=" in disposition
    assert "filename*=UTF-8''" in disposition

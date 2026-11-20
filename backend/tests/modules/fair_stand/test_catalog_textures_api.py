"""Katalog dokuları: admin yükler, Stand saklar ve sunar (kullanıcı kararı 2026-11-18)."""

import io

from PIL import Image


def _png_bytes(size: int = 64) -> bytes:
    image = Image.new("RGB", (size, size), color=(200, 160, 110))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _use_texture_root(monkeypatch, tmp_path):
    monkeypatch.setenv("FAIR_STAND_CATALOG_TEXTURE_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()


def test_admin_uploads_texture_and_it_is_served_from_the_stand_store(client, auth_headers, tmp_path, monkeypatch):
    _use_texture_root(monkeypatch, tmp_path)
    response = client.post(
        "/api/v1/fair-stand/admin/textures",
        headers=auth_headers,
        files={"file": ("mese.png", _png_bytes(), "image/png")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["relativePath"].startswith("uploads/textures/")
    name = body["relativePath"].removeprefix("uploads/textures/")
    # Dosya depo dışındaki kalıcı klasörde durur.
    assert (tmp_path / name).is_file()

    served = client.get(f"/api/v1/fair-stand/textures/{name}")
    assert served.status_code == 200
    assert served.headers["content-type"].startswith("image/")
    assert served.content == (tmp_path / name).read_bytes()


def test_texture_upload_requires_auth_and_rejects_non_images(client, auth_headers, tmp_path, monkeypatch):
    _use_texture_root(monkeypatch, tmp_path)
    unauthenticated = client.post(
        "/api/v1/fair-stand/admin/textures",
        files={"file": ("mese.png", _png_bytes(), "image/png")},
    )
    assert unauthenticated.status_code in {401, 403, 422}
    bad = client.post(
        "/api/v1/fair-stand/admin/textures",
        headers=auth_headers,
        files={"file": ("not-image.png", b"not an image", "image/png")},
    )
    assert bad.status_code == 400


def test_texture_read_accepts_only_generated_names(client, tmp_path, monkeypatch):
    _use_texture_root(monkeypatch, tmp_path)
    (tmp_path / "secret.txt").write_text("x", encoding="utf-8")
    for name in ("secret.txt", "..%2Fsecret.txt", "0" * 32 + ".exe", "0" * 32 + ".png"):
        assert client.get(f"/api/v1/fair-stand/textures/{name}").status_code == 404

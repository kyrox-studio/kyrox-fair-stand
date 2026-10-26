from __future__ import annotations

import io
import struct
import zlib

import pytest
from PIL import Image, ImageFile

from app.modules.fair_stand.application.image_optimize import (
    MAX_DECODE_PIXELS,
    MAX_IMAGE_LONG_EDGE_PX,
    ImageOptimizeError,
    optimize_uploaded_image,
)


def _jpeg_bytes(width: int, height: int, *, quality: int = 85) -> bytes:
    image = Image.new("RGB", (width, height), color=(40, 80, 120))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True)
    return buffer.getvalue()


def test_empty_upload_rejected():
    with pytest.raises(ImageOptimizeError, match="Empty image upload"):
        optimize_uploaded_image(b"", content_type="image/jpeg")


def test_byte_limit_only_user_facing_rejection():
    raw = _jpeg_bytes(64, 64)
    with pytest.raises(ImageOptimizeError, match="exceeds upload limit"):
        optimize_uploaded_image(raw, content_type="image/jpeg", max_upload_bytes=len(raw) - 1)


def _png_header_only(width: int, height: int) -> bytes:
    """Tiny PNG whose header declares width x height; pixel data is never valid to decode."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 1, 0, 0, 0, 0)  # 1-bit grayscale
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"")) + chunk(b"IEND", b"")


@pytest.mark.parametrize(
    ("width", "height"),
    [
        (10_000, 9_000),  # just above the limit: Pillow only warns at open
        (20_000, 20_000),  # far above: Pillow raises DecompressionBombError at open
    ],
)
def test_png_above_pixel_limit_rejected_before_decode(monkeypatch, width, height):
    assert width * height > MAX_DECODE_PIXELS
    raw = _png_header_only(width, height)
    assert len(raw) < 1024

    def _no_decode(self, *args, **kwargs):
        raise AssertionError("pixel data must not be decoded for an over-limit image")

    monkeypatch.setattr(ImageFile.ImageFile, "load", _no_decode)
    with pytest.raises(ImageOptimizeError, match="exceeds pixel limit"):
        optimize_uploaded_image(raw, content_type="image/png")


def test_pixel_limit_is_pillow_default_and_global_is_untouched(monkeypatch):
    assert MAX_DECODE_PIXELS == Image.MAX_IMAGE_PIXELS == 89_478_485
    seen: list[object] = []
    real_open = Image.open

    def _spy_open(*args, **kwargs):
        seen.append(Image.MAX_IMAGE_PIXELS)
        return real_open(*args, **kwargs)

    monkeypatch.setattr(Image, "open", _spy_open)
    optimize_uploaded_image(_jpeg_bytes(64, 64), content_type="image/jpeg")
    assert seen == [89_478_485]
    assert Image.MAX_IMAGE_PIXELS == 89_478_485


def test_high_resolution_image_below_pixel_limit_is_downscaled():
    width, height = 9_000, 6_000  # 54 MP: legitimate camera-class resolution
    assert width * height < MAX_DECODE_PIXELS
    image = Image.new("L", (width, height), color=90)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    image.close()
    optimized = optimize_uploaded_image(buffer.getvalue(), content_type="image/jpeg")
    assert optimized.mime_type in {"image/webp", "image/jpeg"}
    with Image.open(io.BytesIO(optimized.content)) as out:
        assert out.size == (MAX_IMAGE_LONG_EDGE_PX, MAX_IMAGE_LONG_EDGE_PX * 2 // 3)


def test_oversized_long_edge_is_normalized():
    raw = _jpeg_bytes(4000, 2000)
    optimized = optimize_uploaded_image(raw, content_type="image/jpeg")
    with Image.open(io.BytesIO(optimized.content)) as out:
        assert max(out.size) == MAX_IMAGE_LONG_EDGE_PX
        assert min(out.size) == MAX_IMAGE_LONG_EDGE_PX // 2

"""Server-side image normalize: max long edge, strip EXIF, prefer WebP."""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps

MAX_IMAGE_LONG_EDGE_PX = 1536
IMAGE_ENCODE_QUALITY = 75
SVG_MIME = "image/svg+xml"
MAX_DEFAULT_UPLOAD_BYTES = 5 * 1024 * 1024


class ImageOptimizeError(ValueError):
    pass


@dataclass(frozen=True)
class OptimizedImage:
    content: bytes
    mime_type: str
    extension: str


def build_storage_key(*, organization_id, project_id, asset_id, extension: str) -> str:
    ext = extension if extension.startswith(".") else f".{extension}"
    return f"{organization_id}/{project_id}/{asset_id}{ext}"


def _open_raster_for_optimize(raw: bytes) -> Image.Image:
    """Decode raster bytes; pixel count is capped by downscale, not by upload policy."""
    buffer = io.BytesIO(raw)
    previous_limit = Image.MAX_IMAGE_PIXELS
    try:
        Image.MAX_IMAGE_PIXELS = None
        with Image.open(buffer) as opened:
            opened.load()
            return opened.copy()
    finally:
        Image.MAX_IMAGE_PIXELS = previous_limit


def optimize_uploaded_image(
    raw: bytes,
    *,
    content_type: str | None,
    max_upload_bytes: int = MAX_DEFAULT_UPLOAD_BYTES,
) -> OptimizedImage:
    if not raw:
        raise ImageOptimizeError("Empty image upload")
    if len(raw) > max_upload_bytes:
        raise ImageOptimizeError(f"Image exceeds upload limit ({max_upload_bytes} bytes)")

    mime = (content_type or "").split(";")[0].strip().lower()
    if mime == SVG_MIME or (not mime and raw.lstrip().startswith(b"<")):
        # SVG passthrough; strip nothing binary-wise beyond size check.
        return OptimizedImage(content=raw, mime_type=SVG_MIME, extension=".svg")

    if mime and not mime.startswith("image/"):
        raise ImageOptimizeError("Only image/* uploads are allowed")

    try:
        image = _open_raster_for_optimize(raw)
        try:
            image = ImageOps.exif_transpose(image)
            has_alpha = image.mode in ("RGBA", "LA") or (
                image.mode == "P" and "transparency" in image.info
            )
            width, height = image.size
            long_edge = max(width, height)
            if long_edge > MAX_IMAGE_LONG_EDGE_PX:
                scale = MAX_IMAGE_LONG_EDGE_PX / long_edge
                image = image.resize(
                    (max(1, round(width * scale)), max(1, round(height * scale))),
                    Image.Resampling.LANCZOS,
                )

            buffer = io.BytesIO()
            if has_alpha:
                if image.mode not in ("RGBA", "LA"):
                    image = image.convert("RGBA")
                try:
                    image.save(buffer, format="WEBP", quality=IMAGE_ENCODE_QUALITY, method=4)
                    return OptimizedImage(
                        content=buffer.getvalue(),
                        mime_type="image/webp",
                        extension=".webp",
                    )
                except OSError:
                    buffer = io.BytesIO()
                    image.save(buffer, format="PNG", optimize=True)
                    return OptimizedImage(
                        content=buffer.getvalue(),
                        mime_type="image/png",
                        extension=".png",
                    )

            rgb = image.convert("RGB")
            try:
                rgb.save(buffer, format="WEBP", quality=IMAGE_ENCODE_QUALITY, method=4)
                return OptimizedImage(
                    content=buffer.getvalue(),
                    mime_type="image/webp",
                    extension=".webp",
                )
            except OSError:
                buffer = io.BytesIO()
                rgb.save(buffer, format="JPEG", quality=IMAGE_ENCODE_QUALITY, optimize=True)
                return OptimizedImage(
                    content=buffer.getvalue(),
                    mime_type="image/jpeg",
                    extension=".jpg",
                )
        finally:
            image.close()
    except ImageOptimizeError:
        raise
    except Exception as exc:  # noqa: BLE001 — corrupt or unsupported raster
        raise ImageOptimizeError("Image could not be optimized") from exc

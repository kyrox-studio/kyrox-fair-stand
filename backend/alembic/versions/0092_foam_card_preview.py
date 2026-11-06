"""Işıklı Strafor katalog kartına kendi önizlemesi.

Revision ID: 0092_foam_card_preview
Revises: 0091_booth_types

`illuminated-foam` 0084'ten beri düz panel önizlemesini ödünç alıyordu; kart artık koyu zeminde
arkadan ışıklı "LOGO" yazısı gösterir. Item, ölçü, üretim satırı ve kayıtlı projeler değişmez.
Downgrade kartı düz panel önizlemesine döndürür ve bu satırı siler.
"""

from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op


revision = "0092_foam_card_preview"
down_revision = "0091_booth_types"
branch_labels = None
depends_on = None

_ITEM_KEY = "illuminated-foam"
_PANEL_SOURCE = "wall_100_350"
_MARKUP = '<div class="module-drag-foam-logo"></div>'
_CSS = (
    ".module-drag-preview { display:flex; height:78px; align-items:center; justify-content:center; "
    "overflow:hidden; border-radius:7px; background:#fff; }\n"
    ".module-drag-foam-logo { display:flex; width:68px; height:46px; box-sizing:border-box; align-items:center; "
    "justify-content:center; border-radius:4px; background:#1f2933; box-shadow:0 2px 5px rgba(15,23,42,.18); }\n"
    ".module-drag-foam-logo::before { content:'LOGO'; color:#fff; font:800 15px/1 Arial,sans-serif; "
    "letter-spacing:.5px; text-shadow:1px 1px 0 #cbd5e1,0 0 5px #fbbf24,0 0 12px #f97316; }\n"
)


def _preview_id(bind):
    return bind.execute(
        sa.text("SELECT id FROM fair_stand_catalog_preview_kinds WHERE markup = :m ORDER BY id"),
        {"m": _MARKUP},
    ).scalar()


def upgrade() -> None:
    bind = op.get_bind()
    if bind.execute(
        sa.text("SELECT 1 FROM fair_stand_items WHERE item_key = :k AND catalog_visible"), {"k": _ITEM_KEY}
    ).first() is None:
        return
    if _preview_id(bind) is None:
        now = datetime.now(timezone.utc)
        sort_index = bind.execute(
            sa.text("SELECT COALESCE(MAX(sort_index), 0) + 1 FROM fair_stand_catalog_preview_kinds")
        ).scalar_one()
        bind.execute(
            sa.text(
                "INSERT INTO fair_stand_catalog_preview_kinds "
                "(display_name, markup, css_code, sort_index, is_active, created_at, updated_at) "
                "VALUES (:name, :markup, :css, :sort_index, :active, :now, :now)"
            ),
            {"name": "Işıklı Strafor", "markup": _MARKUP, "css": _CSS, "sort_index": sort_index, "active": True, "now": now},
        )
    bind.execute(
        sa.text("UPDATE fair_stand_items SET preview_id = :p WHERE item_key = :k"),
        {"p": _preview_id(bind), "k": _ITEM_KEY},
    )


def downgrade() -> None:
    bind = op.get_bind()
    preview_id = _preview_id(bind)
    if preview_id is None:
        return
    panel_preview = bind.execute(
        sa.text("SELECT preview_id FROM fair_stand_items WHERE item_key = :k"), {"k": _PANEL_SOURCE}
    ).scalar()
    bind.execute(
        sa.text("UPDATE fair_stand_items SET preview_id = :panel WHERE preview_id = :p"),
        {"panel": panel_preview, "p": preview_id},
    )
    bind.execute(sa.text("DELETE FROM fair_stand_catalog_preview_kinds WHERE id = :p"), {"p": preview_id})

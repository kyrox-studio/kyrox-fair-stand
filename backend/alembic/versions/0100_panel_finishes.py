"""Panel tipi: Varsayılan, Antrasit, Siyah, Meşe (`panel-finish`).

Revision ID: 0100_panel_finishes
Revises: 0099_upright_148_5_198

Kullanıcı kararı (2026-11-18):
- Panel tipi stand geneli seçilir ya da seçili panellere atanır; "Varsayılan Panel" grubundaki
  (görsel, renk, Mesh / Lightbox atanmamış) her panel stand tipini alır. Panel olan her modülde
  (duvar, kapı, separatör, vitrin, kısa panel, baza, banko ve sonradan gelenler) geçerlidir.
- Ürün değildir: Üretim Listesi kalemi ve adedi değişmez; yalnız görünüş ve panel dökümünde grup.
- Tipler admin'den yönetilir: her tip katalogda görünmez bir `panel-finish` Item'ıdır. Renk
  `default_color`, doku `texture` görseli (`fair_stand_item_assets`), döşeme ölçüsü `width_cm` ×
  `height_cm`. `panel_finish_default` renksizdir: panel kendi katalog rengiyle (beyaz) çizilir.
- Antrasit RAL 7016 (#383e42, halı antrasitiyle aynı); Siyah profil siyahı (#1c1c1e);
  Meşe dokusu `textures/panel/mese.jpg` (141 × 100 cm, damar soldan sağa; kullanıcı kararı 2026-11-20).
Satırlar `karolaj`'dan kopyalanır (sahne davranışı olmayan zemin satırı); var olan kayıt değişmez.
"""

from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op


revision = "0100_panel_finishes"
down_revision = "0099_upright_148_5_198"
branch_labels = None
depends_on = None

_SOURCE = "karolaj"
_TYPE_KEY = "panel-finish"
_TYPE_NAME = "Panel tipi"
# item_key, ad, renk (None: panelin kendi rengi), döşeme genişliği / yüksekliği cm, doku yolu
_ITEMS = (
    ("panel_finish_default", "Varsayılan", None, None, None, None),
    ("panel_finish_antrasit", "Antrasit", 0x383E42, None, None, None),
    ("panel_finish_siyah", "Siyah", 0x1C1C1E, None, None, None),
    ("panel_finish_mese", "Meşe", 0xD9B27C, 141, 100, "textures/panel/mese.jpg"),
)
_OVERRIDDEN = {
    "item_key", "name", "item_type", "catalog_visible", "default_color", "paintable",
    "created_at", "updated_at",
}


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(tz=UTC)
    bind.execute(
        sa.text(
            """
            INSERT INTO fair_stand_item_type (key, display_name, is_active, created_at, updated_at)
            SELECT :type_key, :display_name, :is_active, :now, :now
            WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_type WHERE key = :type_key)
            """
        ),
        {"type_key": _TYPE_KEY, "display_name": _TYPE_NAME, "is_active": True, "now": now},
    )
    source_exists = bind.execute(
        sa.text("SELECT 1 FROM fair_stand_items WHERE item_key = :k"), {"k": _SOURCE}
    ).scalar()
    if not source_exists:
        return
    copied = [
        column["name"]
        for column in sa.inspect(bind).get_columns("fair_stand_items")
        if column["name"] not in _OVERRIDDEN
    ]
    columns = ", ".join(copied)
    for item_key, name, color, width_cm, height_cm, texture in _ITEMS:
        inserted = bind.execute(
            sa.text(
                "INSERT INTO fair_stand_items (item_key, name, item_type, catalog_visible, default_color, "
                f"paintable, created_at, updated_at, {columns}) "
                f"SELECT :key, :name, :type_key, :visible, :color, :paintable, :now, :now, {columns} "
                "FROM fair_stand_items "
                "WHERE item_key = :source AND NOT EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :key)"
            ),
            {
                "key": item_key,
                "name": name,
                "type_key": _TYPE_KEY,
                "visible": False,
                "color": color,
                "paintable": False,
                "now": now,
                "source": _SOURCE,
            },
        ).rowcount
        if not inserted:
            continue
        if width_cm is not None:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO fair_stand_item_dimensions (item_key, width_cm, height_cm)
                    SELECT :key, :width_cm, :height_cm
                    WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_dimensions WHERE item_key = :key)
                    """
                ),
                {"key": item_key, "width_cm": width_cm, "height_cm": height_cm},
            )
        if texture is not None:
            bind.execute(
                sa.text(
                    "INSERT INTO fair_stand_item_assets (id, item_key, asset_role, relative_path, is_active) "
                    "SELECT :id, :key, 'texture', :path, :active WHERE NOT EXISTS ("
                    "SELECT 1 FROM fair_stand_item_assets WHERE item_key = :key AND asset_role = 'texture')"
                ),
                {"id": str(uuid4()), "key": item_key, "path": texture, "active": True},
            )


def downgrade() -> None:
    bind = op.get_bind()
    for item_key, *_ in _ITEMS:
        bind.execute(sa.text("DELETE FROM fair_stand_item_assets WHERE item_key = :key"), {"key": item_key})
        bind.execute(sa.text("DELETE FROM fair_stand_item_dimensions WHERE item_key = :key"), {"key": item_key})
        bind.execute(sa.text("DELETE FROM fair_stand_items WHERE item_key = :key"), {"key": item_key})
    bind.execute(sa.text("DELETE FROM fair_stand_item_type WHERE key = :key"), {"key": _TYPE_KEY})

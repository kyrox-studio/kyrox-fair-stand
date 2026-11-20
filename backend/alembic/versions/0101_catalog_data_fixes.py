"""Katalog veri düzeltmeleri (canlı DB ile test kataloğu karşılaştırmasında bulunan tutarsızlıklar).

Revision ID: 0101_catalog_data_fixes
Revises: 0100_panel_finishes

Kullanıcı kararı (2026-11-20): test kataloğu DB'den üretilir; DB'deki tutarsız kayıtlar DB'de düzeltilir.
- `box_block`: "Panel Ek Modül" kategorisinde katalog sırası 6 → 5 (görünür kalemlerde sıra 1..N kesintisiz).
- `upright_396`, `upright_445_5`, `upright_495`: katalogda görünmeyen dikme varyantları kategori, katalog
  sırası ve önizleme taşımaz (diğer gizli dikmeler gibi; varyant düğmeleri aile kaydından gelir).
- Gizli raf kalemleri (`shelf_*`, katalogda yalnız Raf kartı görünür): kategori, katalog sırası ve önizleme
  boşaltılır (0086 kararı: ailede yalnız kart görünür, diğerlerinin katalog alanları boşaltılır).
- `profile_49_5`: profil ortak alüminyum rengi (#cdd1d5) ve bırakma yüksekliği 340 (tavan 350 − kesit 10;
  diğer profillerle aynı). Sahne boyu 50 kalır (dikmeye girmeyen profil; kullanıcı kararı 2026-11-20).
- Raf kartlarının sahne yüksekliği çizilen tahtaya (`shelf_W_self`, 3,5 cm; kullanıcı kararı 2026-11-20) uyar:
  tekli 3,5, çift sıra 53,5, üç sıra 103,5. Üretim ölçüsü (`dimensions`, 1,8 tahta) değişmez.
- `base_100`: bağlama yüksekliği 0 → boş (diğer bazalar gibi; baza zemindedir).
- `upright_148_5`, `upright_198`: sahne kesiti 8 × 8 → 10 × 10 (diğer bütün dikmeler gibi; kullanıcı
  kararı 2026-11-20). Üretim ölçüsü (`dimensions`, 8 × 8) değişmez.

Her güncelleme yalnız kayıt hâlâ hatalı değerdeyse uygulanır (admin'den sonradan düzeltilmiş kayda dokunmaz).
"""

import sqlalchemy as sa
from alembic import op


revision = "0101_catalog_data_fixes"
down_revision = "0100_panel_finishes"
branch_labels = None
depends_on = None

HIDDEN_UPRIGHT_VARIANTS = ("upright_396", "upright_445_5", "upright_495")
PROFILE_ALUMINIUM_COLOR = 0xCDD1D5
PROFILE_OLD_COLOR = 0xD0D3D4
# (raf kartları, yeni sahne yüksekliği, eski değerler; son eleman geri almada yazılan değer)
UPRIGHT_SECTION_KEYS = ("upright_148_5", "upright_198")
UPRIGHT_SCENE_SECTION = 10
UPRIGHT_OLD_SCENE_SECTION = 8
SHELF_SCENE_HEIGHTS = (
    (("shelf_100", "shelf_150", "shelf_200", "shelf_row_1"), 3.5, (2, 1.8)),
    (("shelf_row_2", "shelf_row_2_100", "shelf_row_2_150", "shelf_row_2_200"), 53.5, (51.8,)),
    (("shelf_row_3", "shelf_row_3_100", "shelf_row_3_150", "shelf_row_3_200"), 103.5, (101.8,)),
)


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text(
        "UPDATE fair_stand_items SET catalog_item_index = 5 "
        "WHERE item_key = 'box_block' AND catalog_visible AND catalog_item_index = 6"
    ))
    bind.execute(
        sa.text(
            "UPDATE fair_stand_items SET category_id = NULL, catalog_item_index = NULL, preview_id = NULL "
            "WHERE item_key = ANY(:keys) AND NOT catalog_visible"
        ),
        {"keys": list(HIDDEN_UPRIGHT_VARIANTS)},
    )
    bind.execute(sa.text(
        "UPDATE fair_stand_items SET category_id = NULL, catalog_item_index = NULL, preview_id = NULL "
        "WHERE item_type = 'shelf' AND NOT catalog_visible"
    ))
    bind.execute(
        sa.text(
            "UPDATE fair_stand_items SET default_color = :color "
            "WHERE item_key = 'profile_49_5' AND default_color = :old"
        ),
        {"color": PROFILE_ALUMINIUM_COLOR, "old": PROFILE_OLD_COLOR},
    )
    bind.execute(sa.text(
        "UPDATE fair_stand_items SET default_z_cm = 340 "
        "WHERE item_key = 'profile_49_5' AND (default_z_cm IS NULL OR default_z_cm = 0)"
    ))
    for keys, height, old_heights in SHELF_SCENE_HEIGHTS:
        bind.execute(
            sa.text(
                "UPDATE fair_stand_item_scene_dimensions SET height_cm = :height "
                "WHERE item_key = ANY(:keys) AND height_cm = ANY(:old)"
            ),
            {"height": height, "keys": list(keys), "old": list(old_heights)},
        )
    bind.execute(sa.text(
        "UPDATE fair_stand_item_dimensions SET mount_height_cm = NULL "
        "WHERE item_key = 'base_100' AND mount_height_cm = 0"
    ))
    bind.execute(
        sa.text(
            "UPDATE fair_stand_item_scene_dimensions SET width_cm = :section, depth_cm = :section "
            "WHERE item_key = ANY(:keys) AND width_cm = :old AND depth_cm = :old"
        ),
        {"section": UPRIGHT_SCENE_SECTION, "old": UPRIGHT_OLD_SCENE_SECTION, "keys": list(UPRIGHT_SECTION_KEYS)},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text(
        "UPDATE fair_stand_items SET catalog_item_index = 6 "
        "WHERE item_key = 'box_block' AND catalog_item_index = 5"
    ))
    # Gizli dikme ve raf varyantlarının eski kategori / önizleme kimlikleri ortama göre değişir (serial);
    # geri alınmaz. Rengi, yüksekliği ve ölçüyü eski değerine döndür.
    bind.execute(
        sa.text(
            "UPDATE fair_stand_items SET default_color = :old "
            "WHERE item_key = 'profile_49_5' AND default_color = :color"
        ),
        {"color": PROFILE_ALUMINIUM_COLOR, "old": PROFILE_OLD_COLOR},
    )
    bind.execute(sa.text(
        "UPDATE fair_stand_items SET default_z_cm = 0 WHERE item_key = 'profile_49_5' AND default_z_cm = 340"
    ))
    for keys, height, old_heights in SHELF_SCENE_HEIGHTS:
        bind.execute(
            sa.text(
                "UPDATE fair_stand_item_scene_dimensions SET height_cm = :old "
                "WHERE item_key = ANY(:keys) AND height_cm = :height"
            ),
            {"height": height, "keys": list(keys), "old": old_heights[-1]},
        )
    bind.execute(sa.text(
        "UPDATE fair_stand_item_dimensions SET mount_height_cm = 0 "
        "WHERE item_key = 'base_100' AND mount_height_cm IS NULL"
    ))
    bind.execute(
        sa.text(
            "UPDATE fair_stand_item_scene_dimensions SET width_cm = :old, depth_cm = :old "
            "WHERE item_key = ANY(:keys) AND width_cm = :section AND depth_cm = :section"
        ),
        {"section": UPRIGHT_SCENE_SECTION, "old": UPRIGHT_OLD_SCENE_SECTION, "keys": list(UPRIGHT_SECTION_KEYS)},
    )

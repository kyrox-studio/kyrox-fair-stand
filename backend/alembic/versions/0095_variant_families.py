"""Varyant aileleri DB'de: fair_stand_variant_families ve Item.variant FK.

Revision ID: 0095_variant_families
Revises: 0094_demo_usage

Plan: kyrox-platform/projects/fair-stand/VARYANT_AILELERI_ADMIN_PLANI.md (2026-10-25), kullanıcı onayı
2026-11-11. Aile başlığı, katalog kartı adı, sekme adı, etiket kuralı ve eş aile koddan
(`src/catalogWidthFamily.js` VARIANT_FAMILIES) bu tabloya taşınır; CRM admin'den yönetilir.
Bugünkü 13 aile koddaki değerlerle yazılır. Profil ve dikme boyları da `profile` / `upright`
ailesi olur: `item_type` profil / dikme olan Item'ların boş `variant` alanı aile anahtarını alır.
`fair_stand_items.variant` → `family_key` FK. Item anahtarı, reçete, BOM ve kayıtlı proje değişmez.
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

from app.modules.fair_stand.infrastructure.variant_family_seed import (
    ITEM_TYPE_FAMILY_KEYS,
    VARIANT_FAMILY_ROWS,
)

revision = "0095_variant_families"
down_revision = "0094_demo_usage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    families = op.create_table(
        "fair_stand_variant_families",
        sa.Column("family_key", sa.String(64), primary_key=True),
        sa.Column("title", sa.String(128), nullable=False),
        sa.Column("tab_label", sa.String(32), nullable=False),
        sa.Column("card_label", sa.String(64), nullable=True),
        sa.Column("label_rule", sa.String(32), nullable=False),
        sa.Column(
            "option_family_key",
            sa.String(64),
            sa.ForeignKey(
                "fair_stand_variant_families.family_key",
                name="fk_fair_stand_variant_families_option",
                ondelete="RESTRICT",
            ),
            nullable=True,
        ),
        sa.Column("option_label", sa.String(64), nullable=True),
        sa.Column("sort_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "label_rule IN ('width_cm', 'eye_count', 'shelf_rows', 'video_wall_grid', 'name_suffix', "
            "'profile_length', 'upright_height')",
            name="ck_fair_stand_variant_families_label_rule",
        ),
        sa.CheckConstraint(
            "option_family_key IS NULL OR option_family_key <> family_key",
            name="ck_fair_stand_variant_families_option_self",
        ),
        sa.CheckConstraint(
            "(option_family_key IS NULL) = (option_label IS NULL)",
            name="ck_fair_stand_variant_families_option_pair",
        ),
    )
    now = datetime.now(tz=UTC)
    op.bulk_insert(families, [{**row, "created_at": now, "updated_at": now} for row in VARIANT_FAMILY_ROWS])

    bind = op.get_bind()
    for item_type, family_key in ITEM_TYPE_FAMILY_KEYS.items():
        bind.execute(
            sa.text(
                "UPDATE fair_stand_items SET variant = :family_key "
                "WHERE item_type = :item_type AND variant IS NULL"
            ),
            {"family_key": family_key, "item_type": item_type},
        )

    unknown = bind.execute(
        sa.text(
            "SELECT DISTINCT i.variant FROM fair_stand_items i WHERE i.variant IS NOT NULL AND NOT EXISTS ("
            "SELECT 1 FROM fair_stand_variant_families f WHERE f.family_key = i.variant)"
        )
    ).scalars().all()
    if unknown:
        raise RuntimeError("Aile tablosunda olmayan varyant değerleri: " + ", ".join(sorted(unknown)))

    with op.batch_alter_table("fair_stand_items") as batch:
        batch.create_foreign_key(
            "fk_fair_stand_items_variant",
            "fair_stand_variant_families",
            ["variant"],
            ["family_key"],
            ondelete="RESTRICT",
            onupdate="CASCADE",
        )


def downgrade() -> None:
    with op.batch_alter_table("fair_stand_items") as batch:
        batch.drop_constraint("fk_fair_stand_items_variant", type_="foreignkey")
    bind = op.get_bind()
    for item_type, family_key in ITEM_TYPE_FAMILY_KEYS.items():
        bind.execute(
            sa.text("UPDATE fair_stand_items SET variant = NULL WHERE item_type = :item_type AND variant = :family_key"),
            {"family_key": family_key, "item_type": item_type},
        )
    # SQLite DROP TABLE satırları tek tek siler; öz-referanslı RESTRICT bağ önce boşaltılır.
    bind.execute(sa.text("UPDATE fair_stand_variant_families SET option_family_key = NULL, option_label = NULL"))
    op.drop_table("fair_stand_variant_families")

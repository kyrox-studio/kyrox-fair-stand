"""Öğe dikey hareketi ve taban referansı DB'den.

Revision ID: 0076_vertical_move
Revises: 0075_glass_bar_table

Ürün kararı (2026-10-22): sahnede ↑/↓ ile dikey taşınma ve zemin/tavan ölçüsü öğe
ayarıdır (fair_stand_items.vertical_move). Bugün dikey taşınan öğeler açık gelir: TV,
strafor, tül, raf, küp blok, LED projektör, kısa duvarlar; profil yeni açılır.
default_z_cm'in referansı da öğe ayarıdır (z_reference: floor | wall-top). Profil ve
kısa duvarlar wall-top: değer 350 cm duvar tepesine göredir, seçili duvar yüksekliği
farkı kadar kayar (250 cm duvarda profil 240'ta). Downgrade iki kolonu siler.
"""

import sqlalchemy as sa
from alembic import op


revision = "0076_vertical_move"
down_revision = "0075_glass_bar_table"
branch_labels = None
depends_on = None

_VERTICAL_TYPES = ("tv", "illuminated-foam", "tulle-fabric", "shelf", "box-block", "led-floodlight", "profile")
_WALL_SHORT_VARIANTS = ("wall-short-1", "wall-short-2")


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("fair_stand_items")}
    with op.batch_alter_table("fair_stand_items") as batch:
        if "z_reference" not in columns:
            batch.add_column(sa.Column("z_reference", sa.String(16), nullable=False, server_default="floor"))
        if "vertical_move" not in columns:
            batch.add_column(sa.Column("vertical_move", sa.Boolean(), nullable=False, server_default=sa.false()))
    bind = op.get_bind()
    types = ", ".join(f"'{value}'" for value in _VERTICAL_TYPES)
    variants = ", ".join(f"'{value}'" for value in _WALL_SHORT_VARIANTS)
    wall_short = f"(item_type = 'flat-panel' AND variant IN ({variants}))"
    bind.execute(sa.text(f"UPDATE fair_stand_items SET vertical_move = true WHERE item_type IN ({types}) OR {wall_short}"))
    bind.execute(sa.text(f"UPDATE fair_stand_items SET z_reference = 'wall-top' WHERE item_type = 'profile' OR {wall_short}"))
    constraints = {c["name"] for c in sa.inspect(bind).get_check_constraints("fair_stand_items")}
    if "ck_fair_stand_items_z_reference" not in constraints:
        with op.batch_alter_table("fair_stand_items") as batch:
            batch.create_check_constraint("ck_fair_stand_items_z_reference", "z_reference IN ('floor', 'wall-top')")


def downgrade() -> None:
    with op.batch_alter_table("fair_stand_items") as batch:
        batch.drop_constraint("ck_fair_stand_items_z_reference", type_="check")
        batch.drop_column("vertical_move")
        batch.drop_column("z_reference")

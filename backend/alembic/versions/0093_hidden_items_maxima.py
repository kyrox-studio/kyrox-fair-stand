"""Katalogda görünmeyen Maksima Item'ları.

Revision ID: 0093_hidden_items_maxima
Revises: 0092_foam_card_preview

Kullanıcı kararı (2026-11-09): 0091 yalnız katalogda görünen Item'ları Maksima'ya bağlamıştı.
Kart varyantları, gövde parçaları, profil/dikme boyları ve bağlantılar da Maksima'dır. Liste
dışındaki gizli Item'lar null kalır. Var olan eşleme değişmez; yalnız eksik satır eklenir.
"""

import sqlalchemy as sa
from alembic import op

from app.modules.fair_stand.infrastructure.booth_type_seed import (
    DEFAULT_BOOTH_TYPE_KEY,
    HIDDEN_MAXIMA_ITEM_KEYS,
)

revision = "0093_hidden_items_maxima"
down_revision = "0092_foam_card_preview"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(
        sa.text(
            "INSERT INTO fair_stand_item_booth_types (item_key, booth_type_key) "
            "SELECT i.item_key, :booth_type_key FROM fair_stand_items i "
            "WHERE i.item_key IN :keys AND NOT EXISTS ("
            "SELECT 1 FROM fair_stand_item_booth_types b WHERE b.item_key = i.item_key)"
        ).bindparams(sa.bindparam("keys", expanding=True)),
        {"booth_type_key": DEFAULT_BOOTH_TYPE_KEY, "keys": list(HIDDEN_MAXIMA_ITEM_KEYS)},
    )


def downgrade() -> None:
    op.get_bind().execute(
        sa.text(
            "DELETE FROM fair_stand_item_booth_types "
            "WHERE booth_type_key = :booth_type_key AND item_key IN :keys"
        ).bindparams(sa.bindparam("keys", expanding=True)),
        {"booth_type_key": DEFAULT_BOOTH_TYPE_KEY, "keys": list(HIDDEN_MAXIMA_ITEM_KEYS)},
    )

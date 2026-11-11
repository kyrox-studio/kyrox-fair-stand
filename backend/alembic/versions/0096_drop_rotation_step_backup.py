"""0087 dönüş adımı yedek tablosunu kaldır.

Revision ID: 0096_drop_rotation_step_backup
Revises: 0095_variant_families

Kullanıcı kararı (2026-11-11): `fair_stand_rotation_step_0087_backup` yalnız 0087'nin geri alınması
için tutulan yedekti; uygulama okumaz. Yerel ve canlıda 89 satırın hepsi 45° idi. Geri almada tablo
dönüş adımı tanımlı Item'lar için 45° ile yeniden kurulur; böylece 0087 downgrade'i çalışmaya devam eder.
"""

import sqlalchemy as sa
from alembic import op

revision = "0096_drop_rotation_step_backup"
down_revision = "0095_variant_families"
branch_labels = None
depends_on = None

_TABLE = "fair_stand_rotation_step_0087_backup"
_PREVIOUS_STEP_DEG = 45


def upgrade() -> None:
    op.execute(sa.text(f"DROP TABLE IF EXISTS {_TABLE}"))


def downgrade() -> None:
    op.create_table(
        _TABLE,
        sa.Column("item_key", sa.String(128), primary_key=True),
        sa.Column("rotation_step_deg", sa.Numeric(8, 2), nullable=False),
    )
    op.get_bind().execute(
        sa.text(
            f"INSERT INTO {_TABLE} (item_key, rotation_step_deg) "
            "SELECT item_key, :step FROM fair_stand_items WHERE rotation_step_deg IS NOT NULL"
        ),
        {"step": _PREVIOUS_STEP_DEG},
    )

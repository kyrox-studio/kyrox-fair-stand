"""Vitrinin ortak gövde rengini yan sunta Item yetenekleriyle uyumlu yap.

Mevcut dört sunta birlikte boyanır; yan/yatay sunta kayıtları renk kabul eder.
Kimlik, ölçü, reçete ve görsel kabulü değişmez.
"""

import sqlalchemy as sa
from alembic import op

revision = "0085_showcase_body_color"
down_revision = "0084_illuminated_foam_card"
branch_labels = None
depends_on = None


def _set_color(enabled: bool) -> None:
    op.get_bind().execute(
        sa.text(
            "UPDATE fair_stand_items SET accepts_color = :enabled "
            "WHERE item_key IN ('showcase_side_94_6_30', 'showcase_side_143_5_30', 'showcase_horizontal_87_4_30')"
        ),
        {"enabled": enabled},
    )


def upgrade() -> None:
    _set_color(True)


def downgrade() -> None:
    _set_color(False)

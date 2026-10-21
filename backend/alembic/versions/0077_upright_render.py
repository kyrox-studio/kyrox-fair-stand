"""Bütün dikmeler sahnede çizilir (is_render).

Revision ID: 0077_upright_render
Revises: 0076_vertical_move

0068'in eklediği uzun dikmeler (upright_396, upright_445_5, upright_495) is_render
false kalmıştı; dikme boyu penceresinden seçilince ya da 400+ cm duvarda bırakılınca
"Katalog Item kimliği kaybolduğu için modül sahneye eklenmedi" hatası veriyordu.
Yüzey kuralı (item_surface_flags_seed): upright yerleştirilebilir tür → is_render true.
Downgrade dokunmaz (önceki değer hatalıydı).
"""

import sqlalchemy as sa
from alembic import op


revision = "0077_upright_render"
down_revision = "0076_vertical_move"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(
        sa.text("UPDATE fair_stand_items SET is_render = true WHERE item_type = 'upright' AND is_render = false")
    )


def downgrade() -> None:
    pass

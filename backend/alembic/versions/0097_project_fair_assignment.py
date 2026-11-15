"""Add optional fair assignment to stand projects."""

import sqlalchemy as sa
from alembic import op

revision = "0097_project_fair_assignment"
down_revision = "0096_drop_rotation_step_backup"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fair_stand_projects", sa.Column("fair_id", sa.Uuid(), nullable=True))


def downgrade() -> None:
    op.drop_column("fair_stand_projects", "fair_id")

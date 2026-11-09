"""Oturumsuz demo kullanım sayacı tablosu.

Revision ID: 0094_demo_usage
Revises: 0093_hidden_items_maxima

ADR-0012 (2026-11-09): giriş yapmadan editör denemesi 24 saatte sınırlı süre çalışır.
Sayaç sunucuda tutulur; tarayıcı çerezi ve IP yalnız HMAC özeti olarak saklanır.
"""

import sqlalchemy as sa
from alembic import op

revision = "0094_demo_usage"
down_revision = "0093_hidden_items_maxima"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fair_stand_demo_usage",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("subject_kind", sa.String(16), nullable=False),
        sa.Column("subject_hash", sa.String(64), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("subject_kind", "subject_hash", name="uq_fair_stand_demo_usage_subject"),
        sa.CheckConstraint("subject_kind IN ('ip', 'browser')", name="ck_fair_stand_demo_usage_kind"),
        sa.CheckConstraint("used_seconds >= 0", name="ck_fair_stand_demo_usage_used"),
    )
    op.create_index("ix_fair_stand_demo_usage_last_seen_at", "fair_stand_demo_usage", ["last_seen_at"])


def downgrade() -> None:
    op.drop_index("ix_fair_stand_demo_usage_last_seen_at", table_name="fair_stand_demo_usage")
    op.drop_table("fair_stand_demo_usage")

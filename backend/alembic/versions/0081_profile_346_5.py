"""Profil 346,5 normal profil; admin kaynaklı sahne profilleri normal profillere taşınır.

Revision ID: 0081_profile_346_5
Revises: 0080_item_length_parts

Ürün kararı (2026-10-23): katalogda "sahne" profili kalmaz. Admin ekranında açılmış
`profile_X_scene` kartları (41,5 / 91 / 140,5 / 190 / 239,5 / 289 / 346,5) aynı ölçülü normal
profile (`profile_X`) çevrilir: proje, revizyon ve grup şablonu kayıtlarındaki anahtar da çevrilir
(0078 düzeni). 346,5'in normal karşılığı yoktu: `profile_346_5` ("Profil 346,5", gerçek 346,5 /
sahne 350, kesit 10 × 10) eklenir — `profile_346_5_scene` varsa yeniden adlandırılır, yoksa
`profile_388`'den kopyalanır. Downgrade yalnız `profile_346_5`'i siler; anahtar çevirisi geri alınmaz.
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op


revision = "0081_profile_346_5"
down_revision = "0080_item_length_parts"
branch_labels = None
depends_on = None

_SOURCE = "profile_388"
_NEW = "profile_346_5"
_NEW_NAME = "Profil 346,5"
_NEW_REAL_CM = 346.5
_NEW_SCENE_CM = 350
_SCENE_SECTION_CM = 10
_LEGACY = ("41_5", "91", "140_5", "190", "239_5", "289", "346_5")
_OVERRIDDEN = {"item_key", "name", "catalog_visible", "created_at", "updated_at"}


def _exists(bind, item_key: str) -> bool:
    return bool(
        bind.execute(sa.text("SELECT 1 FROM fair_stand_items WHERE item_key = :k"), {"k": item_key}).scalar()
    )


def _rewrite_payloads(bind, old: str, new: str) -> None:
    # Proje, revizyon ve şablon JSON'ları itemKey metnini gömülü taşır (FK ile çevrilmez).
    postgres = bind.dialect.name == "postgresql"
    as_text = "payload::text" if postgres else "payload"
    as_json = "::jsonb" if postgres else ""
    inspector = sa.inspect(bind)
    for table in ("fair_stand_projects", "fair_stand_project_revisions", "fair_stand_group_templates"):
        if not inspector.has_table(table) or "payload" not in {c["name"] for c in inspector.get_columns(table)}:
            continue
        bind.execute(
            sa.text(
                f"UPDATE {table} SET payload = replace({as_text}, :old, :new){as_json} "
                f"WHERE {as_text} LIKE '%' || :old || '%'"
            ),
            {"old": f'"{old}"', "new": f'"{new}"'},
        )


def _add_profile_346_5(bind) -> None:
    legacy = f"{_NEW}_scene"
    if not _exists(bind, _NEW):
        if _exists(bind, legacy):
            # FK kolonları fair_stand_items.item_key'e ON UPDATE CASCADE ile bağlıdır.
            bind.execute(
                sa.text("UPDATE fair_stand_items SET item_key = :new WHERE item_key = :old"),
                {"old": legacy, "new": _NEW},
            )
        elif _exists(bind, _SOURCE):
            copied = [
                column["name"]
                for column in sa.inspect(bind).get_columns("fair_stand_items")
                if column["name"] not in _OVERRIDDEN
            ]
            columns = ", ".join(copied)
            now = datetime.now(tz=UTC)
            bind.execute(
                sa.text(
                    f"INSERT INTO fair_stand_items (item_key, name, catalog_visible, created_at, updated_at, {columns}) "
                    f"SELECT :key, :name, false, :now, :now, {columns} FROM fair_stand_items WHERE item_key = :source"
                ),
                {"key": _NEW, "name": _NEW_NAME, "now": now, "source": _SOURCE},
            )
        else:
            return
    bind.execute(
        sa.text("UPDATE fair_stand_items SET name = :name, catalog_visible = false WHERE item_key = :key"),
        {"key": _NEW, "name": _NEW_NAME},
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO fair_stand_item_dimensions (item_key, width_cm, depth_cm, height_cm)
            SELECT :key, :real, 8, 8
            WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_dimensions WHERE item_key = :key)
            """
        ),
        {"key": _NEW, "real": _NEW_REAL_CM},
    )
    bind.execute(
        sa.text("UPDATE fair_stand_item_dimensions SET width_cm = :real WHERE item_key = :key"),
        {"key": _NEW, "real": _NEW_REAL_CM},
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO fair_stand_item_scene_dimensions (item_key, width_cm, depth_cm, height_cm)
            SELECT :key, :scene, :section, :section
            WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_scene_dimensions WHERE item_key = :key)
            """
        ),
        {"key": _NEW, "scene": _NEW_SCENE_CM, "section": _SCENE_SECTION_CM},
    )
    bind.execute(
        sa.text(
            "UPDATE fair_stand_item_scene_dimensions SET width_cm = :scene, depth_cm = :section, "
            "height_cm = :section WHERE item_key = :key"
        ),
        {"key": _NEW, "scene": _NEW_SCENE_CM, "section": _SCENE_SECTION_CM},
    )


def upgrade() -> None:
    bind = op.get_bind()
    _add_profile_346_5(bind)
    for size in _LEGACY:
        legacy = f"profile_{size}_scene"
        target = f"profile_{size}"
        if not _exists(bind, target):
            continue
        _rewrite_payloads(bind, legacy, target)
        # Bağlı ölçü/maliyet satırları ON DELETE CASCADE ile gider.
        bind.execute(sa.text("DELETE FROM fair_stand_items WHERE item_key = :k"), {"k": legacy})


def downgrade() -> None:
    bind = op.get_bind()
    for table in ("fair_stand_item_scene_dimensions", "fair_stand_item_dimensions", "fair_stand_items"):
        bind.execute(sa.text(f"DELETE FROM {table} WHERE item_key = :k"), {"k": _NEW})

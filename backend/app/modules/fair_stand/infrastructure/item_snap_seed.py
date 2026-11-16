"""Snap catalog seed: item_type + rule_type + rule (UI-editable).

Runtime does NOT read item_type maps. This module only:
- ensures rule_type `snap` and initial rules/item_types exist
- stamps seed dicts with rule codes for FK resolution
"""

from __future__ import annotations

from datetime import UTC, datetime

import sqlalchemy as sa

SNAP_FACES = frozenset({"front", "back", "top", "bottom", "left", "right"})
SNAP_EDGES = frozenset({"top", "bottom", "left", "right"})

RULE_TYPE_SNAP = "snap"

# One-time seed DATA (not runtime). face/edge only — mount_mode yok.
_INITIAL_ITEM_TYPES: tuple[tuple[str, str], ...] = (
    ("profile", "Profil"),
    ("panel", "Panel"),
    ("panel-glass", "Cam panel"),
    ("separator-panel", "Ayırıcı panel"),
    ("shelf", "Raf"),
    ("led-floodlight", "Projektör"),
    ("flat-panel", "Düz panel / duvar"),
)

# Alembic 0024 import alias (family naming)
_INITIAL_FAMILIES = _INITIAL_ITEM_TYPES

# key, display_name, face, edge
# top-rail: lamba ← profil üst yüz üst kenar
# shelf-rail: raf ← panel ön yüz üst kenar (X’e bakan)
_INITIAL_RULES: tuple[tuple[str, str, str | None, str | None], ...] = (
    ("top-rail", "Üst ray", "top", "top"),
    ("shelf-rail", "Raf rayı", "front", "top"),
)

# rule key → item_type keys (provides tarafı / kuralın uygulandığı tipler)
_INITIAL_RULE_ITEM_TYPES: dict[str, tuple[str, ...]] = {
    "top-rail": ("profile",),
    "shelf-rail": ("panel", "separator-panel"),
}

# item_type → (requires_rule_code, provides_rule_code) — seed/migration only
_SEED_ITEM_BINDINGS: dict[str, tuple[str | None, str | None]] = {
    "led-floodlight": ("top-rail", None),
    "shelf": ("shelf-rail", None),
    "profile": (None, "top-rail"),
    "panel": (None, "shelf-rail"),
    "separator-panel": (None, "shelf-rail"),
    "flat-panel": (None, None),
}


def _now() -> datetime:
    return datetime.now(tz=UTC)


def snap_binding_for_item_type(item_type: str) -> tuple[str | None, str | None]:
    return _SEED_ITEM_BINDINGS.get(item_type, (None, None))


def apply_item_snap_fields(row: dict) -> dict:
    requires, provides = snap_binding_for_item_type(row["item_type"])
    row["snap_requires_rule_code"] = requires
    row["snap_provides_rule_code"] = provides
    row["snap_target_item_type"] = None
    row["snap_anchor"] = None
    row.pop("family_code", None)
    row.pop("snap_requires", None)
    row.pop("snap_provides", None)
    row.pop("snap_face", None)
    row.pop("snap_edge", None)
    return row


# Legacy 0007 migration / dump path before rule FKs existed.
_LEGACY_TYPE_ANCHOR: dict[str, tuple[str | None, str | None]] = {
    "led-floodlight": ("profile", "top"),
    "shelf": ("panel", "top"),
}


def fill_item_snap_columns(bind) -> None:
    """Idempotent fill for migrations/dump.

    - New schema (snap_*_rule_id): ensure catalog + bind rule FKs
    - Legacy schema: snap_target_item_type / snap_anchor (0007)
    """
    cols = {c["name"] for c in sa.inspect(bind).get_columns("fair_stand_items")}
    if "snap_requires_rule_id" in cols:
        from sqlalchemy.orm import Session

        session = Session(bind=bind)
        try:
            maps = ensure_snap_catalog(session)
            session.flush()
            bind_item_snap_fks(bind, rules=maps["rules"])
            session.flush()
        finally:
            session.close()
        return

    rows = bind.execute(sa.text("SELECT item_key, item_type FROM fair_stand_items")).mappings()
    for row in rows:
        target, anchor = _LEGACY_TYPE_ANCHOR.get(row["item_type"], (None, None))
        bind.execute(
            sa.text(
                "UPDATE fair_stand_items SET snap_target_item_type = :target, snap_anchor = :anchor "
                "WHERE item_key = :item_key"
            ),
            {"target": target, "anchor": anchor, "item_key": row["item_key"]},
        )


def ensure_item_types(session, keys: list[str] | set[str] | tuple[str, ...]) -> dict[str, int]:
    """Ensure catalog rows exist for every item_type key (FK target)."""
    from app.modules.fair_stand.infrastructure.item_type_behavior_seed import (
        NON_SCENE_ITEM_TYPE_KEYS,
        behavior_slice1_for_type,
        behavior_slice2_for_type,
        behavior_slice3_for_type,
    )
    from app.modules.fair_stand.infrastructure.models import (
        FairStandItemTypeModel,
        FairStandItemTypeSceneBehaviorModel,
    )

    now = _now()
    known = {key: name for key, name in _INITIAL_ITEM_TYPES}
    result: dict[str, int] = {}
    for key in sorted({str(k).strip() for k in keys if str(k).strip()}):
        row = session.scalar(sa.select(FairStandItemTypeModel).where(FairStandItemTypeModel.key == key))
        if row is None:
            display_name = {
                "production": "Üretim",
                "tulle-fabric": "Tül",
                "floor-piece": "Zemin parçası",
            }.get(key, known.get(key, key))
            row = FairStandItemTypeModel(
                key=key,
                display_name=display_name,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            session.flush()
            if key not in NON_SCENE_ITEM_TYPE_KEYS:
                placement, collision, move_snap_cm = behavior_slice1_for_type(key)
                magnetic_snap, allow_side, supports_overlay, wall_capacity = behavior_slice2_for_type(key)
                (
                    connection_endpoint,
                    collision_depth,
                    endpoint_contact,
                    boundary_snap,
                    collision_height,
                    _overlap,
                    ghost_kind,
                    ghost_renderer,
                    ghost_opacity,
                ) = behavior_slice3_for_type(key)
                session.add(
                    FairStandItemTypeSceneBehaviorModel(
                        item_type_id=row.id,
                        placement=placement,
                        collision=collision,
                        move_snap_cm=move_snap_cm,
                        magnetic_snap=magnetic_snap,
                        allow_side_insert=allow_side,
                        supports_wall_overlay_mount=supports_overlay,
                        wall_capacity=wall_capacity,
                        connection_endpoint=connection_endpoint,
                        collision_depth=collision_depth,
                        endpoint_contact=endpoint_contact,
                        boundary_snap=boundary_snap,
                        collision_height=collision_height,
                        ghost_kind=ghost_kind,
                        ghost_renderer=ghost_renderer,
                        ghost_opacity=ghost_opacity,
                    )
                )
                session.flush()
        result[key] = int(row.id)
    return result


def ensure_snap_catalog(session) -> dict[str, dict[str, int]]:
    """Idempotent: rule_type snap, initial rules/item_types. Returns id maps by key."""
    from app.modules.fair_stand.infrastructure.models import (
        FairStandItemTypeModel,
        FairStandRuleModel,
        FairStandRuleTypeModel,
    )

    now = _now()
    rule_type = session.scalar(
        sa.select(FairStandRuleTypeModel).where(FairStandRuleTypeModel.key == RULE_TYPE_SNAP)
    )
    if rule_type is None:
        rule_type = FairStandRuleTypeModel(
            key=RULE_TYPE_SNAP,
            display_name="Snap",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        session.add(rule_type)
        session.flush()

    item_types = ensure_item_types(session, [key for key, _ in _INITIAL_ITEM_TYPES])

    rules: dict[str, int] = {}
    for key, name, face, edge in _INITIAL_RULES:
        row = session.scalar(
            sa.select(FairStandRuleModel).where(
                FairStandRuleModel.rule_type_id == rule_type.id,
                FairStandRuleModel.key == key,
            )
        )
        if row is None:
            row = FairStandRuleModel(
                rule_type_id=int(rule_type.id),
                key=key,
                display_name=name,
                face=face,
                edge=edge,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            session.flush()
        else:
            row.face = face
            row.edge = edge
            row.display_name = name
        rules[key] = int(row.id)

    # Kural ↔ item_type bağları (M:N)
    for rule_key, type_keys in _INITIAL_RULE_ITEM_TYPES.items():
        rule_id = rules.get(rule_key)
        if rule_id is None:
            continue
        rule_row = session.get(FairStandRuleModel, rule_id)
        if rule_row is None:
            continue
        linked = []
        for type_key in type_keys:
            type_id = item_types.get(type_key)
            if type_id is None:
                continue
            type_row = session.get(FairStandItemTypeModel, type_id)
            if type_row is not None:
                linked.append(type_row)
        rule_row.item_types = linked

    session.flush()
    return {
        "item_types": item_types,
        "rules": rules,
        "rule_types": {RULE_TYPE_SNAP: int(rule_type.id)},
    }


def bind_item_snap_fks(
    bind,
    *,
    rules: dict[str, int],
    families: dict[str, int] | None = None,
) -> None:
    """Migration helper: set rule FKs (and legacy family_id if column still exists)."""
    cols = {c["name"] for c in sa.inspect(bind).get_columns("fair_stand_items")}
    has_family = "family_id" in cols and families is not None
    rows = bind.execute(sa.text("SELECT item_key, item_type FROM fair_stand_items")).mappings()
    for row in rows:
        requires, provides = snap_binding_for_item_type(row["item_type"])
        # Old 3-tuple bindings returned (family, requires, provides); tolerate either.
        if isinstance(requires, tuple):  # pragma: no cover
            _, requires, provides = requires  # type: ignore[misc]
        params = {
            "requires_id": rules.get(requires) if requires else None,
            "provides_id": rules.get(provides) if provides else None,
            "item_key": row["item_key"],
        }
        if has_family:
            # Seed map keys were item_type; family key == item_type for initial set.
            family_key = row["item_type"] if row["item_type"] in (families or {}) else None
            params["family_id"] = families.get(family_key) if family_key else None  # type: ignore[union-attr]
            bind.execute(
                sa.text(
                    """
                    UPDATE fair_stand_items
                    SET family_id = :family_id,
                        snap_requires_rule_id = :requires_id,
                        snap_provides_rule_id = :provides_id,
                        snap_target_item_type = NULL,
                        snap_anchor = NULL
                    WHERE item_key = :item_key
                    """
                ),
                params,
            )
        else:
            bind.execute(
                sa.text(
                    """
                    UPDATE fair_stand_items
                    SET snap_requires_rule_id = :requires_id,
                        snap_provides_rule_id = :provides_id,
                        snap_target_item_type = NULL,
                        snap_anchor = NULL
                    WHERE item_key = :item_key
                    """
                ),
                params,
            )

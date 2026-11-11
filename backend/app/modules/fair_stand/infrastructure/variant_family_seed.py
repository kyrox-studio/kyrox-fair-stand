"""Varyant aileleri (0095): kodda duran `VARIANT_FAMILIES` tablosunun DB karşılığı.

Migration 0095 ve test seed'i aynı satırları kullanır. `profile` ve `upright` aileleri bugüne kadar
tipten (`item_type`) çözülen profil / dikme boylarıdır; bırakılırken boy penceresi açılır.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.fair_stand.infrastructure.models import FairStandItemModel, FairStandVariantFamilyModel

LABEL_RULES = (
    "width_cm",
    "eye_count",
    "shelf_rows",
    "video_wall_grid",
    "name_suffix",
    "profile_length",
    "upright_height",
)

# Kod bu anahtarlara bağlıdır: kısa panel (autoFascia, items.js), profil ve dikme boy penceresi.
SYSTEM_FAMILY_KEYS = ("wall-short-1", "wall-short-2", "profile", "upright")

# Profil / dikme tipindeki Item'lar bu ailelere girer (0095 verisi; sonrası admin'den yönetilir).
ITEM_TYPE_FAMILY_KEYS = {"profile": "profile", "upright": "upright"}


def _row(
    family_key: str,
    title: str,
    tab_label: str,
    label_rule: str,
    sort_index: int,
    *,
    card_label: str | None = None,
    option_family_key: str | None = None,
    option_label: str | None = None,
) -> dict:
    return {
        "family_key": family_key,
        "title": title,
        "tab_label": tab_label,
        "card_label": card_label,
        "label_rule": label_rule,
        "option_family_key": option_family_key,
        "option_label": option_label,
        "sort_index": sort_index,
        "is_system": family_key in SYSTEM_FAMILY_KEYS,
        "is_active": True,
    }


# Eş aile (option) hedefi önce yazılır; FK sırası.
VARIANT_FAMILY_ROWS = (
    _row("wall-panel", "Panel genişliği", "Genişlik", "width_cm", 10),
    _row("wall-short-1", "Panel genişliği", "Genişlik", "width_cm", 20),
    _row("wall-short-2", "Panel genişliği", "Genişlik", "width_cm", 30),
    _row("wall-separator-sarmasik", "Separatör genişliği", "Genişlik", "width_cm", 50),
    _row(
        "wall-separator",
        "Separatör genişliği",
        "Genişlik",
        "width_cm",
        40,
        option_family_key="wall-separator-sarmasik",
        option_label="Sarmaşıklı",
    ),
    _row("desk-banko", "Banko ölçüsü", "Genişlik", "width_cm", 60),
    _row("desk-banko-l", "Köşe banko ölçüsü", "Genişlik", "width_cm", 70),
    _row("base", "Baza ölçüsü", "Genişlik", "width_cm", 80),
    _row("wall-showcase", "Vitrin", "Boyut", "eye_count", 90, card_label="Vitrin"),
    _row("shelf-row", "Raf", "Boyut", "shelf_rows", 100, card_label="Raf"),
    _row("tv", "Ekran boyu", "Boyut", "name_suffix", 110, card_label="TV"),
    _row("video-wall", "Video Wall düzeni", "Düzen", "video_wall_grid", 120, card_label="Video Wall"),
    _row("long-planter", "Saksı ölçüsü", "Ölçü", "width_cm", 130, card_label="Uzun Saksı"),
    _row("profile", "Profil boyu", "Boy", "profile_length", 140, card_label="Profil"),
    _row("upright", "Dikme yüksekliği", "Yükseklik", "upright_height", 150, card_label="Dikme"),
)


def ensure_variant_families(session: Session) -> None:
    """Eksik aileyi ekler, profil / dikme Item'larını ailesine bağlar. Var olan satır değişmez."""
    existing = set(session.scalars(select(FairStandVariantFamilyModel.family_key)).all())
    now = datetime.now(tz=UTC)
    for row in VARIANT_FAMILY_ROWS:
        if row["family_key"] in existing:
            continue
        session.add(FairStandVariantFamilyModel(**row, created_at=now, updated_at=now))
        session.flush()
    for item_type, family_key in ITEM_TYPE_FAMILY_KEYS.items():
        session.execute(
            update(FairStandItemModel)
            .where(FairStandItemModel.item_type == item_type, FairStandItemModel.variant.is_(None))
            .values(variant=family_key)
        )
    session.flush()

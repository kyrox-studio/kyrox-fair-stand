"""Admin CRUD for fair_stand_variant_families (0095).

Yetki Item admin izinleridir (kullanıcı kararı 2026-10-25); ayrı CRUD kuralı yoktur.
Aile anahtarı oluşturulduktan sonra değişmez. Sistem aileleri (kodun bağlı olduğu kısa panel,
profil, dikme) arşivlenemez; etiket kuralı ve eş aileleri değiştirilemez, yalnız metinleri değişir.
Ailenin kartı, üyelerinden katalogda görünen Item'dır (Item formundaki "katalogda görünür").
"""

from __future__ import annotations

import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.fair_stand.infrastructure.models import FairStandItemModel, FairStandVariantFamilyModel
from app.modules.fair_stand.infrastructure.variant_family_seed import LABEL_RULES

MAX_MEMBERS = 500
_FAMILY_KEY_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class VariantFamilyAdminError(ValueError):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _required_text(value: object, *, field: str, max_length: int) -> str:
    text = str(value if value is not None else "").strip()
    if not text:
        raise VariantFamilyAdminError(f"{field} zorunludur.")
    if len(text) > max_length:
        raise VariantFamilyAdminError(f"{field} en fazla {max_length} karakter olabilir.")
    return text


def _optional_text(value: object, *, field: str, max_length: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) > max_length:
        raise VariantFamilyAdminError(f"{field} en fazla {max_length} karakter olabilir.")
    return text


def _family_key(value: object) -> str:
    key = _required_text(value, field="Aile anahtarı", max_length=64).lower()
    if not _FAMILY_KEY_RE.match(key):
        raise VariantFamilyAdminError("Aile anahtarı küçük harf, rakam ve tire içerir (ör. wall-panel).")
    return key


def _label_rule(value: object) -> str:
    rule = str(value or "").strip()
    if rule not in LABEL_RULES:
        raise VariantFamilyAdminError("Etiket kuralı geçersiz.")
    return rule


def family_payload(row: FairStandVariantFamilyModel) -> dict:
    """Bootstrap ve admin listesinin ortak alanları."""
    return {
        "key": row.family_key,
        "title": row.title,
        "tabLabel": row.tab_label,
        "cardLabel": row.card_label,
        "labelRule": row.label_rule,
        "optionFamilyKey": row.option_family_key,
        "optionLabel": row.option_label,
        "sortIndex": int(row.sort_index),
    }


class AdminVariantFamiliesService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _get(self, family_key: str) -> FairStandVariantFamilyModel:
        row = self._session.get(FairStandVariantFamilyModel, str(family_key))
        if row is None:
            raise VariantFamilyAdminError("Varyant ailesi bulunamadı.", status_code=404)
        return row

    def _flush(self) -> None:
        try:
            with self._session.begin_nested():
                self._session.flush()
        except IntegrityError as exc:
            orig = str(getattr(exc, "orig", exc)).lower()
            if "fair_stand_variant_families_pkey" in orig or "unique" in orig or "duplicate" in orig:
                raise VariantFamilyAdminError("Bu aile anahtarı zaten kayıtlı.", status_code=409) from exc
            raise VariantFamilyAdminError("Kayıt kaydedilemedi.", status_code=409) from exc

    def _members(self) -> dict[str, list[dict]]:
        rows = self._session.execute(
            select(
                FairStandItemModel.variant,
                FairStandItemModel.item_key,
                FairStandItemModel.name,
                FairStandItemModel.catalog_visible,
                FairStandItemModel.is_render,
            )
            .where(FairStandItemModel.variant.is_not(None))
            .order_by(FairStandItemModel.item_key)
        ).all()
        members: dict[str, list[dict]] = {}
        for variant, item_key, name, catalog_visible, is_render in rows:
            members.setdefault(variant, []).append(
                {
                    "itemKey": item_key,
                    "name": name,
                    "catalogVisible": bool(catalog_visible),
                    "isRender": bool(is_render),
                }
            )
        return members

    def _admin_payload(self, row: FairStandVariantFamilyModel, members: dict[str, list[dict]]) -> dict:
        return {
            **family_payload(row),
            "isSystem": bool(row.is_system),
            "isActive": bool(row.is_active),
            "members": members.get(row.family_key, []),
        }

    def list_families(self) -> list[dict]:
        rows = self._session.scalars(
            select(FairStandVariantFamilyModel).order_by(
                FairStandVariantFamilyModel.sort_index, FairStandVariantFamilyModel.family_key
            )
        ).all()
        members = self._members()
        return [self._admin_payload(row, members) for row in rows]

    def get_family(self, family_key: str) -> dict:
        return self._admin_payload(self._get(family_key), self._members())

    def _option(self, family_key: str, option_family_key: object, option_label: object) -> tuple[str | None, str | None]:
        option_key = _optional_text(option_family_key, field="Eş aile", max_length=64)
        label = _optional_text(option_label, field="Eş aile etiketi", max_length=64)
        if option_key is None:
            if label is not None:
                raise VariantFamilyAdminError("Eş aile etiketi yalnız eş aile seçilince yazılır.")
            return None, None
        if label is None:
            raise VariantFamilyAdminError("Eş aile seçilince etiketi zorunludur (ör. Sarmaşıklı).")
        if option_key == family_key:
            raise VariantFamilyAdminError("Aile kendisinin eş ailesi olamaz.")
        target = self._session.get(FairStandVariantFamilyModel, option_key)
        if target is None or not target.is_active:
            raise VariantFamilyAdminError("Eş aile bulunamadı ya da arşivde.")
        if target.option_family_key is not None:
            raise VariantFamilyAdminError("Eş ailenin kendi eş ailesi olamaz.")
        parent = self._session.scalar(
            select(FairStandVariantFamilyModel.family_key).where(
                FairStandVariantFamilyModel.option_family_key == option_key,
                FairStandVariantFamilyModel.family_key != family_key,
            )
        )
        if parent is not None:
            raise VariantFamilyAdminError(f"Bu eş aile zaten {parent} ailesine bağlı.")
        if self._session.scalar(
            select(FairStandVariantFamilyModel.family_key).where(
                FairStandVariantFamilyModel.option_family_key == family_key
            )
        ):
            raise VariantFamilyAdminError("Başka ailenin eş ailesi olan aile eş aile seçemez.")
        return option_key, label

    def create_family(self, payload: dict) -> dict:
        family_key = _family_key(payload.get("family_key"))
        if self._session.get(FairStandVariantFamilyModel, family_key) is not None:
            raise VariantFamilyAdminError("Bu aile anahtarı zaten kayıtlı.", status_code=409)
        option_key, option_label = self._option(family_key, payload.get("option_family_key"), payload.get("option_label"))
        now = _now()
        row = FairStandVariantFamilyModel(
            family_key=family_key,
            title=_required_text(payload.get("title"), field="Başlık", max_length=128),
            tab_label=_required_text(payload.get("tab_label"), field="Sekme adı", max_length=32),
            card_label=_optional_text(payload.get("card_label"), field="Kart adı", max_length=64),
            label_rule=_label_rule(payload.get("label_rule")),
            option_family_key=option_key,
            option_label=option_label,
            sort_index=int(payload.get("sort_index") or 0),
            is_system=False,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        self._session.add(row)
        self._flush()
        return self.get_family(family_key)

    def update_family(self, family_key: str, payload: dict) -> dict:
        row = self._get(family_key)
        if "title" in payload:
            row.title = _required_text(payload.get("title"), field="Başlık", max_length=128)
        if "tab_label" in payload:
            row.tab_label = _required_text(payload.get("tab_label"), field="Sekme adı", max_length=32)
        if "card_label" in payload:
            row.card_label = _optional_text(payload.get("card_label"), field="Kart adı", max_length=64)
        if "sort_index" in payload and payload.get("sort_index") is not None:
            row.sort_index = int(payload["sort_index"])
        if "label_rule" in payload:
            rule = _label_rule(payload.get("label_rule"))
            if row.is_system and rule != row.label_rule:
                raise VariantFamilyAdminError("Sistem ailesinin etiket kuralı değiştirilemez.")
            row.label_rule = rule
        if "option_family_key" in payload or "option_label" in payload:
            option_key, option_label = self._option(
                row.family_key,
                payload.get("option_family_key", row.option_family_key),
                payload.get("option_label", row.option_label),
            )
            if row.is_system and option_key != row.option_family_key:
                raise VariantFamilyAdminError("Sistem ailesinin eş ailesi değiştirilemez.")
            row.option_family_key = option_key
            row.option_label = option_label
        row.updated_at = _now()
        self._flush()
        return self.get_family(row.family_key)

    def archive_family(self, family_key: str) -> dict:
        row = self._get(family_key)
        if row.is_system:
            raise VariantFamilyAdminError("Sistem ailesi arşivlenemez; kod bu aileye bağlı.", status_code=409)
        parent = self._session.scalar(
            select(FairStandVariantFamilyModel.family_key).where(
                FairStandVariantFamilyModel.option_family_key == row.family_key,
                FairStandVariantFamilyModel.is_active.is_(True),
            )
        )
        if parent is not None:
            raise VariantFamilyAdminError(f"Önce {parent} ailesinden eş aile bağlantısını kaldırın.", status_code=409)
        row.is_active = False
        row.updated_at = _now()
        self._flush()
        return self.get_family(row.family_key)

    def list_member_candidates(self) -> list[dict]:
        """Aile penceresinde toplu seçim için etkin Item'lar: tip ve bugünkü ailesiyle."""
        rows = self._session.execute(
            select(
                FairStandItemModel.item_key,
                FairStandItemModel.name,
                FairStandItemModel.item_type,
                FairStandItemModel.variant,
                FairStandItemModel.catalog_visible,
                FairStandItemModel.is_render,
            )
            .where(FairStandItemModel.is_active.is_(True))
            .order_by(FairStandItemModel.item_type, FairStandItemModel.item_key)
        ).all()
        return [
            {
                "itemKey": item_key,
                "name": name,
                "type": item_type,
                "variant": variant,
                "catalogVisible": bool(catalog_visible),
                "isRender": bool(is_render),
            }
            for item_key, name, item_type, variant, catalog_visible, is_render in rows
        ]

    def set_members(self, family_key: str, item_keys: list[str]) -> dict:
        """Ailenin üyelerini toplu yazar: listedekiler bu aileye geçer (başka aileden de), çıkanlar ailesiz olur."""
        row = self._get(family_key)
        if not row.is_active:
            raise VariantFamilyAdminError("Arşivdeki aileye üye eklenmez; önce geri alın.")
        wanted = {str(key).strip() for key in item_keys if str(key).strip()}
        if len(wanted) > MAX_MEMBERS:
            raise VariantFamilyAdminError(f"Bir ailede en fazla {MAX_MEMBERS} üye olur.")
        found = set(
            self._session.scalars(
                select(FairStandItemModel.item_key).where(FairStandItemModel.item_key.in_(wanted))
            ).all()
        ) if wanted else set()
        unknown = sorted(wanted - found)
        if unknown:
            raise VariantFamilyAdminError("Bulunamayan Item: " + ", ".join(unknown[:10]))
        current = set(
            self._session.scalars(
                select(FairStandItemModel.item_key).where(FairStandItemModel.variant == row.family_key)
            ).all()
        )
        for item in self._session.scalars(
            select(FairStandItemModel).where(FairStandItemModel.item_key.in_((wanted - current) | (current - wanted)))
        ).all():
            item.variant = row.family_key if item.item_key in wanted else None
            item.updated_at = _now()
        row.updated_at = _now()
        self._flush()
        return self.get_family(row.family_key)

    def restore_family(self, family_key: str) -> dict:
        row = self._get(family_key)
        row.is_active = True
        row.updated_at = _now()
        self._flush()
        return self.get_family(row.family_key)


def require_known_variant(session: Session, variant: str | None, *, current: str | None = None) -> str | None:
    """Item.variant: boş ya da etkin aile. Arşivdeki aileye yeni bağ kurulmaz; mevcut bağ korunur."""
    if variant is None:
        return None
    row = session.get(FairStandVariantFamilyModel, variant)
    if row is None:
        raise VariantFamilyAdminError("Varyant ailesi bulunamadı; önce Varyant aileleri ekranında tanımlayın.")
    if not row.is_active and variant != current:
        raise VariantFamilyAdminError("Varyant ailesi arşivde.")
    return variant

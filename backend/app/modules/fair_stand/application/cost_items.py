"""Organization-scoped Item and manual cost lines."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.fair_stand.infrastructure.models import (
    FairStandCostItemModel,
    FairStandItemModel,
    FairStandUnitModel,
)

_MONEY = Decimal("0.01")
_ITEM = "ITEM"
_MANUAL = "MANUAL"


class CostItemServiceError(Exception):
    def __init__(self, message: str, *, status_code: int = 422) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class CostItemView:
    id: UUID
    organization_id: UUID
    cost_item_type: str
    item_key: str | None
    name: str | None
    unit: str | None
    purchase_price: Decimal
    sale_price: Decimal
    created_at: datetime
    updated_at: datetime


def _now() -> datetime:
    return datetime.now(tz=UTC)


def money_amount(value: Decimal | int | str | None, *, field: str, required: bool) -> Decimal:
    if value is None:
        if required:
            raise CostItemServiceError(f"{field} is required")
        return Decimal("0.00")
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise CostItemServiceError(f"{field} must be a number") from exc
    if not amount.is_finite():
        raise CostItemServiceError(f"{field} must be a number")
    if amount < 0:
        raise CostItemServiceError(f"{field} must be greater than or equal to 0")
    quantized = amount.quantize(_MONEY)
    if quantized != amount:
        raise CostItemServiceError(f"{field} supports at most 2 decimal places")
    return quantized


def _text(value: str | None) -> str:
    return (value or "").strip()


def _view(row: FairStandCostItemModel) -> CostItemView:
    return CostItemView(
        id=row.id,
        organization_id=row.organization_id,
        cost_item_type=row.cost_item_type,
        item_key=row.item_key,
        name=row.name,
        unit=row.unit,
        purchase_price=Decimal(row.purchase_price).quantize(_MONEY),
        sale_price=Decimal(row.sale_price).quantize(_MONEY),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class CostItemService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _require_priced_item(self, item_key: str) -> None:
        row = self._session.get(FairStandItemModel, item_key)
        if row is None or not row.is_active or not row.is_cost_enabled:
            raise CostItemServiceError("Item is not available for organization pricing")

    def _require_unit(self, unit_key: str) -> None:
        row = self._session.scalar(
            select(FairStandUnitModel.id).where(FairStandUnitModel.unit_key == unit_key)
        )
        if row is None:
            raise CostItemServiceError("Unit is not in the catalog")

    def list_cost_items(self, organization_id: UUID) -> list[CostItemView]:
        rows = self._session.scalars(
            select(FairStandCostItemModel)
            .where(FairStandCostItemModel.organization_id == organization_id)
            .order_by(
                FairStandCostItemModel.cost_item_type,
                FairStandCostItemModel.item_key,
                FairStandCostItemModel.name,
                FairStandCostItemModel.id,
            )
        ).all()
        return [_view(row) for row in rows]

    def create_cost_item(
        self,
        *,
        organization_id: UUID,
        cost_item_type: str | None,
        item_key: str | None,
        name: str | None,
        unit: str | None,
        purchase_price: Decimal | int | str | None,
        sale_price: Decimal | int | str | None,
    ) -> CostItemView:
        kind = _text(cost_item_type)
        if not kind:
            kind = _ITEM if _text(item_key) else ""
        if kind not in {_ITEM, _MANUAL}:
            raise CostItemServiceError("itemKey is required" if not kind else "costItemType must be ITEM or MANUAL")
        purchase = money_amount(purchase_price, field="purchasePrice", required=True)
        sale = money_amount(sale_price, field="salePrice", required=False)
        now = _now()
        if kind == _ITEM:
            self._reject_manual_fields(name=name, unit=unit)
            cleaned_key = _text(item_key)
            if not cleaned_key:
                raise CostItemServiceError("itemKey is required")
            self._require_priced_item(cleaned_key)
            existing = self._session.scalar(
                select(FairStandCostItemModel.id).where(
                    FairStandCostItemModel.organization_id == organization_id,
                    FairStandCostItemModel.item_key == cleaned_key,
                )
            )
            if existing is not None:
                raise CostItemServiceError("Item price already exists", status_code=409)
            row = FairStandCostItemModel(
                id=uuid4(),
                organization_id=organization_id,
                cost_item_type=_ITEM,
                item_key=cleaned_key,
                name=None,
                unit=None,
                purchase_price=purchase,
                sale_price=sale,
                created_at=now,
                updated_at=now,
            )
        else:
            if _text(item_key):
                raise CostItemServiceError("itemKey is not used for a manual cost item")
            cleaned_name = _text(name)
            if not cleaned_name:
                raise CostItemServiceError("name is required")
            if len(cleaned_name) > 256:
                raise CostItemServiceError("name is too long")
            cleaned_unit = _text(unit)
            if not cleaned_unit:
                raise CostItemServiceError("unit is required")
            self._require_unit(cleaned_unit)
            row = FairStandCostItemModel(
                id=uuid4(),
                organization_id=organization_id,
                cost_item_type=_MANUAL,
                item_key=None,
                name=cleaned_name,
                unit=cleaned_unit,
                purchase_price=purchase,
                sale_price=sale,
                created_at=now,
                updated_at=now,
            )
        self._session.add(row)
        try:
            self._session.flush()
        except IntegrityError as exc:
            self._raise_integrity(exc)
        self._session.refresh(row)
        return _view(row)

    def update_cost_item(
        self,
        *,
        price_id: UUID,
        organization_id: UUID,
        cost_item_type: str | None = None,
        cost_item_type_provided: bool = False,
        item_key: str | None = None,
        item_key_provided: bool = False,
        name: str | None = None,
        name_provided: bool = False,
        unit: str | None = None,
        unit_provided: bool = False,
        purchase_price: Decimal | int | str | None = None,
        purchase_provided: bool = False,
        sale_price: Decimal | int | str | None = None,
        sale_provided: bool = False,
    ) -> CostItemView | None:
        row = self._session.scalar(
            select(FairStandCostItemModel).where(
                FairStandCostItemModel.id == price_id,
                FairStandCostItemModel.organization_id == organization_id,
            )
        )
        if row is None:
            return None
        if cost_item_type_provided and _text(cost_item_type) not in {"", row.cost_item_type}:
            raise CostItemServiceError("costItemType cannot change")
        if row.cost_item_type == _ITEM:
            if item_key_provided and _text(item_key) not in {"", row.item_key}:
                raise CostItemServiceError("itemKey cannot change")
            if name_provided and _text(name):
                raise CostItemServiceError("name is not used for an item cost item")
            if unit_provided and _text(unit):
                raise CostItemServiceError("unit is not used for an item cost item")
        else:
            if item_key_provided and _text(item_key):
                raise CostItemServiceError("itemKey is not used for a manual cost item")
            if name_provided:
                cleaned_name = _text(name)
                if not cleaned_name:
                    raise CostItemServiceError("name is required")
                if len(cleaned_name) > 256:
                    raise CostItemServiceError("name is too long")
                row.name = cleaned_name
            if unit_provided:
                cleaned_unit = _text(unit)
                if not cleaned_unit:
                    raise CostItemServiceError("unit is required")
                self._require_unit(cleaned_unit)
                row.unit = cleaned_unit
        if purchase_provided:
            row.purchase_price = money_amount(purchase_price, field="purchasePrice", required=True)
        if sale_provided:
            row.sale_price = money_amount(sale_price, field="salePrice", required=False)
        row.updated_at = _now()
        try:
            self._session.flush()
        except IntegrityError as exc:
            self._raise_integrity(exc)
        self._session.refresh(row)
        return _view(row)

    def delete_cost_item(self, price_id: UUID, organization_id: UUID) -> bool:
        row = self._session.scalar(
            select(FairStandCostItemModel).where(
                FairStandCostItemModel.id == price_id,
                FairStandCostItemModel.organization_id == organization_id,
            )
        )
        if row is None:
            return False
        self._session.delete(row)
        self._session.flush()
        return True

    def _reject_manual_fields(self, *, name: str | None, unit: str | None) -> None:
        if _text(name):
            raise CostItemServiceError("name is not used for an item cost item")
        if _text(unit):
            raise CostItemServiceError("unit is not used for an item cost item")

    def _raise_integrity(self, exc: IntegrityError) -> None:
        message = str(getattr(exc, "orig", exc)).lower()
        if "unique" in message or "item_key" in message:
            raise CostItemServiceError("Item price already exists", status_code=409) from exc
        raise CostItemServiceError("Cost item is not valid") from exc

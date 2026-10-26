"""Organization-scoped cost item HTTP API."""

from __future__ import annotations

from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.integrations.kyrox_core.auth import AuthContext
from app.modules.fair_stand.api.dependencies import (
    PERMISSION_COST_ITEMS_CREATE,
    PERMISSION_COST_ITEMS_DELETE,
    PERMISSION_COST_ITEMS_READ,
    PERMISSION_COST_ITEMS_UPDATE,
    get_cost_item_service,
    require_permission,
)
from app.modules.fair_stand.application.cost_items import CostItemService, CostItemServiceError, CostItemView

router = APIRouter(prefix="/fair-stand/cost-items", tags=["fair-stand-cost-items"])


class CostItemCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    cost_item_type: Literal["ITEM", "MANUAL"] | None = Field(default=None, alias="costItemType")
    item_key: str | None = Field(default=None, alias="itemKey", max_length=128)
    name: str | None = Field(default=None, max_length=256)
    unit: str | None = Field(default=None, max_length=64)
    purchase_price: Decimal = Field(alias="purchasePrice")
    sale_price: Decimal | None = Field(default=None, alias="salePrice")


class CostItemUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    cost_item_type: Literal["ITEM", "MANUAL"] | None = Field(default=None, alias="costItemType")
    item_key: str | None = Field(default=None, alias="itemKey", max_length=128)
    name: str | None = Field(default=None, max_length=256)
    unit: str | None = Field(default=None, max_length=64)
    purchase_price: Decimal | None = Field(default=None, alias="purchasePrice")
    sale_price: Decimal | None = Field(default=None, alias="salePrice")


def _raise_service(exc: CostItemServiceError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


def _money(value: Decimal) -> str:
    return format(Decimal(value), "f")


def _json(price: CostItemView) -> dict[str, str | int | None]:
    return {
        "id": str(price.id),
        "organizationId": str(price.organization_id),
        "costItemType": price.cost_item_type,
        "itemKey": price.item_key,
        "name": price.name,
        "unit": price.unit,
        "purchasePrice": _money(price.purchase_price),
        "salePrice": _money(price.sale_price),
        "createdAt": int(price.created_at.timestamp() * 1000),
        "updatedAt": int(price.updated_at.timestamp() * 1000),
    }


@router.get("")
def list_cost_items(
    auth: AuthContext = Depends(require_permission(PERMISSION_COST_ITEMS_READ)),
    service: CostItemService = Depends(get_cost_item_service),
) -> dict[str, list[dict[str, str | int | None]]]:
    return {"prices": [_json(price) for price in service.list_cost_items(auth.organization_id)]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_cost_item(
    body: CostItemCreateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_COST_ITEMS_CREATE)),
    service: CostItemService = Depends(get_cost_item_service),
) -> dict[str, str | int | None]:
    try:
        price = service.create_cost_item(
            organization_id=auth.organization_id,
            cost_item_type=body.cost_item_type,
            item_key=body.item_key,
            name=body.name,
            unit=body.unit,
            purchase_price=body.purchase_price,
            sale_price=body.sale_price,
        )
    except CostItemServiceError as exc:
        _raise_service(exc)
    return _json(price)


@router.patch("/{price_id}")
def update_cost_item(
    price_id: UUID,
    body: CostItemUpdateBody,
    auth: AuthContext = Depends(require_permission(PERMISSION_COST_ITEMS_UPDATE)),
    service: CostItemService = Depends(get_cost_item_service),
) -> dict[str, str | int | None]:
    fields = body.model_fields_set
    try:
        price = service.update_cost_item(
            price_id=price_id,
            organization_id=auth.organization_id,
            cost_item_type=body.cost_item_type,
            cost_item_type_provided="cost_item_type" in fields,
            item_key=body.item_key,
            item_key_provided="item_key" in fields,
            name=body.name,
            name_provided="name" in fields,
            unit=body.unit,
            unit_provided="unit" in fields,
            purchase_price=body.purchase_price,
            purchase_provided="purchase_price" in fields,
            sale_price=body.sale_price,
            sale_provided="sale_price" in fields,
        )
    except CostItemServiceError as exc:
        _raise_service(exc)
    if price is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item price not found")
    return _json(price)


@router.delete("/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cost_item(
    price_id: UUID,
    auth: AuthContext = Depends(require_permission(PERMISSION_COST_ITEMS_DELETE)),
    service: CostItemService = Depends(get_cost_item_service),
) -> None:
    if not service.delete_cost_item(price_id, auth.organization_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item price not found")
